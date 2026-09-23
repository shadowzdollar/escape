/*
  Escape: Overdrive - dual thumbstick controller (Arduino Uno + 2x KY-023 joystick modules)

  Streams both sticks to the game over USB serial at 115200 baud, ~100 times per second:

      J,<lx>,<ly>,<lb>,<rx>,<ry>,<rb>\n

  lx/ly/rx/ry = 0..1023 raw analog values (smoothed), lb/rb = 1 when the stick is pressed down.
  The game (Chrome/Edge, Web Serial) calibrates the centre and dead-zone itself.

  Serial commands (send from the Arduino Serial Monitor, 115200 baud, or from the game):
      h  -> replies "HELLO,ESCAPE-JOY,1"  (handshake used by the game)
      t  -> toggles a human readable TEST view, to check your wiring
      s  -> back to streaming mode

  Default wiring (change the pin constants below if yours differ):
      LEFT  stick : VRx -> A0, VRy -> A1, SW -> D2, +5V -> 5V, GND -> GND
      RIGHT stick : VRx -> A2, VRy -> A3, SW -> D3, +5V -> 5V, GND -> GND
*/

// ---------------------------------------------------------------- pins
const uint8_t LEFT_X_PIN = A0;
const uint8_t LEFT_Y_PIN = A1;
const uint8_t LEFT_SW_PIN = 2;
const uint8_t RIGHT_X_PIN = A2;
const uint8_t RIGHT_Y_PIN = A3;
const uint8_t RIGHT_SW_PIN = 3;

// ---------------------------------------------------------------- tuning
const unsigned long BAUD = 115200;
const unsigned long SEND_PERIOD_MS = 10;   // 100 Hz
const uint8_t SAMPLES = 4;                 // analog oversampling per axis
const float SMOOTHING = 0.5;               // 0 = no smoothing, closer to 1 = smoother but laggier
const unsigned long DEBOUNCE_MS = 15;

struct Button {
  uint8_t pin;
  bool stable;          // debounced state (true = pressed)
  bool lastRaw;
  unsigned long changedAt;
};

Button leftBtn = { LEFT_SW_PIN, false, false, 0 };
Button rightBtn = { RIGHT_SW_PIN, false, false, 0 };

float axis[4];                     // smoothed lx, ly, rx, ry
const uint8_t AXIS_PINS[4] = { LEFT_X_PIN, LEFT_Y_PIN, RIGHT_X_PIN, RIGHT_Y_PIN };

bool testMode = false;
unsigned long lastSend = 0;

int readAxis(uint8_t pin) {
  analogRead(pin);                 // throw away first read after switching the ADC mux
  long sum = 0;
  for (uint8_t i = 0; i < SAMPLES; i++) sum += analogRead(pin);
  return (int)(sum / SAMPLES);
}

void updateButton(Button &b, unsigned long now) {
  bool raw = digitalRead(b.pin) == LOW;   // KY-023 switch pulls to GND when pressed
  if (raw != b.lastRaw) {
    b.lastRaw = raw;
    b.changedAt = now;
  }
  if (now - b.changedAt >= DEBOUNCE_MS) b.stable = raw;
}

void handleCommands() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == 'h' || c == 'H') Serial.println(F("HELLO,ESCAPE-JOY,1"));
    else if (c == 't' || c == 'T') { testMode = true; Serial.println(F("# TEST MODE - move the sticks. Send 's' to stream again.")); }
    else if (c == 's' || c == 'S') testMode = false;
  }
}

void printBar(const char *label, int v) {
  // small ASCII bar so you can see which way each axis moves
  Serial.print(label);
  Serial.print(F(" "));
  if (v < 1000) Serial.print(' ');
  if (v < 100) Serial.print(' ');
  if (v < 10) Serial.print(' ');
  Serial.print(v);
  Serial.print(F(" ["));
  int pos = map(v, 0, 1023, 0, 20);
  for (int i = 0; i <= 20; i++) Serial.print(i == pos ? '#' : (i == 10 ? '|' : '-'));
  Serial.print(F("]  "));
}

void setup() {
  Serial.begin(BAUD);
  pinMode(LEFT_SW_PIN, INPUT_PULLUP);
  pinMode(RIGHT_SW_PIN, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT);
  for (uint8_t i = 0; i < 4; i++) axis[i] = readAxis(AXIS_PINS[i]);
  // short blink = ready
  for (uint8_t i = 0; i < 3; i++) {
    digitalWrite(LED_BUILTIN, HIGH); delay(80);
    digitalWrite(LED_BUILTIN, LOW); delay(80);
  }
  Serial.println(F("HELLO,ESCAPE-JOY,1"));
}

void loop() {
  unsigned long now = millis();
  handleCommands();
  updateButton(leftBtn, now);
  updateButton(rightBtn, now);

  if (now - lastSend < (testMode ? 100 : SEND_PERIOD_MS)) return;
  lastSend = now;

  for (uint8_t i = 0; i < 4; i++) {
    axis[i] = axis[i] * SMOOTHING + readAxis(AXIS_PINS[i]) * (1.0 - SMOOTHING);
  }
  int lx = (int)(axis[0] + 0.5), ly = (int)(axis[1] + 0.5);
  int rx = (int)(axis[2] + 0.5), ry = (int)(axis[3] + 0.5);

  // onboard LED lights while any stick button is held (handy wiring check)
  digitalWrite(LED_BUILTIN, (leftBtn.stable || rightBtn.stable) ? HIGH : LOW);

  if (testMode) {
    printBar("LX", lx); printBar("LY", ly);
    Serial.print(leftBtn.stable ? F("L:DOWN  ") : F("L:up    "));
    printBar("RX", rx); printBar("RY", ry);
    Serial.println(rightBtn.stable ? F("R:DOWN") : F("R:up"));
    return;
  }

  Serial.print('J'); Serial.print(',');
  Serial.print(lx); Serial.print(',');
  Serial.print(ly); Serial.print(',');
  Serial.print(leftBtn.stable ? 1 : 0); Serial.print(',');
  Serial.print(rx); Serial.print(',');
  Serial.print(ry); Serial.print(',');
  Serial.println(rightBtn.stable ? 1 : 0);
}
