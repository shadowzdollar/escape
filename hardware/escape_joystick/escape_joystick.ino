/*
  Escape: Overdrive - dual joystick controller, USB + Bluetooth
  Board: Arduino Uno + 2x KY-023 thumbsticks + HC-05 (or HC-06) Bluetooth module

  The same packet goes out on both links, so the controller works with the USB cable
  AND wirelessly over Bluetooth without re-uploading:
      J,<leftX>,<leftY>,<leftButton>,<rightX>,<rightY>,<rightButton>\n

  HC-05 wiring (see hardware/README.md):
      HC-05 VCC -> D9        (powered from a pin, switched on in setup())
      HC-05 GND -> GND
      HC-05 TXD -> D10
      HC-05 RXD <- D11 through a 1k / 2k voltage divider (3.3 V logic)

  Serial commands (USB Serial Monitor at 115200, or over Bluetooth):
      h -> "HELLO,ESCAPE-JOY,2"    t -> test view with live bars    s -> back to streaming
      r -> power-cycle the HC-05 (D9 off for half a second)
*/

#include <SoftwareSerial.h>

// ---------------------------------------------------------------- pins
const uint8_t LEFT_X_PIN = A0;
const uint8_t LEFT_Y_PIN = A1;
const uint8_t LEFT_SW_PIN = 2;
const uint8_t RIGHT_X_PIN = A2;
const uint8_t RIGHT_Y_PIN = A3;
const uint8_t RIGHT_SW_PIN = 3;
  // HC-05 VCC: a digital pin driven HIGH (5 V) powers the module
const uint8_t BT_RX_PIN = 10;  // Arduino receives here  <- HC-05 TXD
const uint8_t BT_TX_PIN = 11;  // Arduino transmits here -> HC-05 RXD (via divider)

SoftwareSerial BTSerial(BT_RX_PIN, BT_TX_PIN);

// ---------------------------------------------------------------- tuning
// HC-05 modules ship at 9600 baud. A packet is ~22 bytes, and 9600 baud moves ~960 bytes/s,
// so 25 packets/s is the safe maximum. If you raise the module to 38400 with the AT command
// in the README, set BT_BAUD = 38400 and the controller streams at 60 Hz.
const unsigned long BT_BAUD = 9600;
const unsigned long USB_BAUD = 115200;
const unsigned long SEND_PERIOD_MS = BT_BAUD >= 38400 ? 16 : 40;
 // let the HC-05 start up after its power pin goes HIGH
const uint8_t SAMPLES = 4;             // oversampling per axis
const float SMOOTHING = 0.35;          // exponential moving average (0 = off)
const unsigned long DEBOUNCE_MS = 15;

struct Button {
  uint8_t pin;
  bool stable;          // debounced state (true = pressed)
  bool lastRaw;
  unsigned long changedAt;
};

Button leftBtn = { LEFT_SW_PIN, false, false, 0 };
Button rightBtn = { RIGHT_SW_PIN, false, false, 0 };

float axis[4];  // smoothed lx, ly, rx, ry
const uint8_t AXIS_PINS[4] = { LEFT_X_PIN, LEFT_Y_PIN, RIGHT_X_PIN, RIGHT_Y_PIN };

bool testMode = false;
unsigned long lastSend = 0;

int readAxis(uint8_t pin) {
  analogRead(pin);  // throw away the first read after switching the ADC multiplexer
  long sum = 0;
  for (uint8_t i = 0; i < SAMPLES; i++) sum += analogRead(pin);
  return (int)(sum / SAMPLES);
}

void updateButton(Button &b, unsigned long now) {
  bool raw = (digitalRead(b.pin) == LOW);  // switch pulls to GND when pressed
  if (raw != b.lastRaw) {
    b.lastRaw = raw;
    b.changedAt = now;
  }
  if (now - b.changedAt >= DEBOUNCE_MS) b.stable = raw;
}

// Switch the HC-05 on through its power pin and give it time to boot.


void handleCommand(char c, Stream &reply) {
  if (c == 'h' || c == 'H') {
    reply.println(F("HELLO,ESCAPE-JOY,2"));
  }
  else if (c == 't' || c == 'T') {
    testMode = true;
    reply.println(F("# TEST MODE (s = stream)"));
  }
  else if (c == 's' || c == 'S') {
    testMode = false;
  }
}

// "LX  512 [----------#----------]" style bar for the Serial Monitor test mode
void bar(Stream &out, const char *name, int v) {
  out.print(name); out.print(' ');
  if (v < 1000) out.print(' ');
  if (v < 100) out.print(' ');
  if (v < 10) out.print(' ');
  out.print(v); out.print(F(" ["));
  int pos = map(v, 0, 1023, 0, 20);
  for (int i = 0; i <= 20; i++) out.print(i == pos ? '#' : '-');
  out.print(F("]  "));
}

void sendPacket(Stream &out, int lx, int ly, int rx, int ry) {
  // one print per packet keeps SoftwareSerial writes tight
  char line[40];
  snprintf(line, sizeof(line), "J,%d,%d,%d,%d,%d,%d\n", lx, ly, leftBtn.stable ? 1 : 0, rx, ry, rightBtn.stable ? 1 : 0);
  out.print(line);
}

void setup() {
 
  Serial.begin(USB_BAUD);
  BTSerial.begin(BT_BAUD);
  pinMode(LEFT_SW_PIN, INPUT_PULLUP);
  pinMode(RIGHT_SW_PIN, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT);
  for (uint8_t i = 0; i < 4; i++) axis[i] = readAxis(AXIS_PINS[i]);
  for (uint8_t i = 0; i < 3; i++) {  // 3 blinks = ready
    digitalWrite(LED_BUILTIN, HIGH); delay(80);
    digitalWrite(LED_BUILTIN, LOW); delay(80);
  }
  Serial.println(F("HELLO,ESCAPE-JOY,2"));
  BTSerial.println(F("HELLO,ESCAPE-JOY,2"));
}

void loop() {
  unsigned long now = millis();
  while (Serial.available()) handleCommand(Serial.read(), Serial);
  while (BTSerial.available()) handleCommand(BTSerial.read(), BTSerial);
  updateButton(leftBtn, now);
  updateButton(rightBtn, now);

  if (now - lastSend < (testMode ? 100 : SEND_PERIOD_MS)) return;
  lastSend = now;

  for (uint8_t i = 0; i < 4; i++) axis[i] = axis[i] * SMOOTHING + readAxis(AXIS_PINS[i]) * (1.0 - SMOOTHING);
  int lx = (int)(axis[0] + 0.5), ly = (int)(axis[1] + 0.5);
  int rx = (int)(axis[2] + 0.5), ry = (int)(axis[3] + 0.5);
  digitalWrite(LED_BUILTIN, (leftBtn.stable || rightBtn.stable) ? HIGH : LOW);

  if (testMode) {
    bar(Serial, "LX", lx); bar(Serial, "LY", ly);
    Serial.print(leftBtn.stable ? F("L:DOWN  ") : F("L:up    "));
    bar(Serial, "RX", rx); bar(Serial, "RY", ry);
    Serial.println(rightBtn.stable ? F("R:DOWN") : F("R:up"));
    return;
  }
  sendPacket(Serial, lx, ly, rx, ry);    // USB cable
  sendPacket(BTSerial, lx, ly, rx, ry);  // Bluetooth
}
