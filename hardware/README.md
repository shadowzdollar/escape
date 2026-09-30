# BENAX Arduino Joystick → Escape: Overdrive

Your controller is an **Arduino Uno** with **two KY-023 thumbstick modules** in a 3D-printed case.
The Uno streams both sticks over USB serial **and** Bluetooth (HC-05), and the game reads them in the browser
(Web Serial API, or the dev server's Bluetooth bridge). You don't need drivers, extra software or a keyboard.

## 1. Wiring

Each KY-023 module has 5 pins: `GND`, `+5V`, `VRx`, `VRy`, `SW`.

| Module pin | LEFT stick | RIGHT stick |
|---|---|---|
| GND  | GND | GND |
| +5V  | 5V  | 5V  |
| VRx  | **A0** | **A2** |
| VRy  | **A1** | **A3** |
| SW   | **D2** | **D3** |

Both modules share the Uno's 5V and GND pins. If your wires already go to different pins,
don't re-wire: just change the pin constants at the top of `escape_joystick/escape_joystick.ino`.

```
            ┌──────────── Arduino UNO ────────────┐
 LEFT  VRx ─┤ A0                              D2 ├─ LEFT  SW
 LEFT  VRy ─┤ A1                              D3 ├─ RIGHT SW
 RIGHT VRx ─┤ A2                                 │
 RIGHT VRy ─┤ A3                              5V ├─ +5V (both modules)
            │                                GND ├─ GND (both modules)
            └─────────────────[USB]───────────────┘
```

## 2. Upload the sketch

1. Open **Arduino IDE** → *File → Open* → `hardware/escape_joystick/escape_joystick.ino`
2. *Tools → Board* → **Arduino Uno**, *Tools → Port* → your controller's port
   (`/dev/ttyUSB0` / `/dev/ttyACM0` on Linux, `COMx` on Windows)
3. Click **Upload**. The onboard LED blinks 3 times when it's ready.

> On Linux, if the port is "permission denied", run `sudo usermod -aG dialout $USER`, then log out and back in.

## 3. Check the wiring (optional but recommended)

Open *Tools → Serial Monitor*, set **115200 baud**, type `t` and press Enter. You'll see live bars:

```
LX  512 [----------#----------]  LY  520 [----------#----------]  L:up    RX ...
```

Move each stick and press each one. Every bar should move and `L:DOWN` / `R:DOWN` should appear.
Type `s` to go back to streaming mode. **Close the Serial Monitor before playing**, because only one
program can use the port at a time.

## 4. Connect to the game

1. Start the game (`npm run dev`) and open it in **Chrome or Edge**. Firefox and Safari have no Web Serial support.
2. Go to **Settings → Arduino joystick → CONNECT** and pick the Uno's port. This is needed only the first time.
   After that the game reconnects automatically whenever you plug the controller in.
3. **Keep both sticks untouched for about half a second** while it calibrates. The menu badge turns green:
   **🎮 CONTROLLER READY**.

## 5. Play wirelessly (Bluetooth HC-05 / HC-06)

The sketch sends every packet over **both** USB and Bluetooth, so the same upload works with
or without the cable.

### Wiring the HC-05

| HC-05 pin | Arduino |
|---|---|
| VCC | 5V |
| GND | GND |
| TXD | **D10** |
| RXD | **D11** through a voltage divider: D11 → 1 kΩ → RXD, and RXD → 2 kΩ → GND |

The HC-05 RX pin is 3.3 V logic, so the divider protects it. STATE and EN stay unconnected.
D10/D11 are used (not D0/D1), so you can still upload sketches with the HC-05 plugged in.

**Power without the cable:** use a USB power bank in the Uno's USB socket, or a 9 V battery
(or 6×AA) into the barrel jack. When powered, the HC-05 LED blinks fast (not connected yet).

### Pair it with the PC (Linux, one time)

```bash
bluetoothctl
  power on
  agent on
  scan on            # wait for "HC-05", note its address, e.g. 19:AE:4F:7E:F5:A9
  pair 19:AE:4F:7E:F5:A9      # PIN is 1234 (sometimes 0000)
  trust 19:AE:4F:7E:F5:A9
  quit
sudo rfcomm bind 0 19:AE:4F:7E:F5:A9 1    # creates /dev/rfcomm0
```

`rfcomm bind` is lost after a reboot, so run that last line again after restarting.
Check it with `rfcomm -a`; it should show `rfcomm0: <address> channel 1`.

### Connect in the game

Just run `npm run dev` and open the game in Chrome. The dev server has a small Bluetooth bridge
(`hardware/joy-bridge.mjs`) that opens `/dev/rfcomm0` and passes the stick data to the game on
its own. After 2–5 seconds the HC-05 LED changes to slow double blinks (connected), the terminal
prints `[joy-bridge] connected to /dev/rfcomm0`, and the menu badge turns **🎮 CONTROLLER READY**.
Leave the sticks centred for a second while it calibrates.

Other options:
- **Settings → CONNECT** in Chrome/Edge also lists paired Bluetooth serial devices (HC-05) next to
  USB ports, so you can pick it there. This also works on Windows, where the HC-05 appears as a COM port.
- Use a different device with `JOY_PORT=/dev/rfcomm1 npm run dev`.

If the link drops (out of range or battery), the game reconnects by itself every few seconds.

### Faster Bluetooth (optional)

HC-05 modules ship at 9600 baud, which carries about 25 packets per second. That's fine to play,
but 38400 is smoother:
1. Power the HC-05 while holding its small button (or with EN tied to 3.3 V). The LED blinks slowly: that's AT mode, which always talks at 38400 baud.
2. With a USB-UART adapter (or any serial terminal wired to the HC-05 at 38400 baud, line ending "Both NL & CR"), send `AT+UART=38400,0,0`. It answers `OK`.
3. Set `BT_BAUD = 38400` at the top of the sketch and upload. The controller now streams at 60 Hz.

## Controls

| In the game | Controller |
|---|---|
| Steer | **Left stick** left / right |
| Gas | **Right stick** up (analog: push further to go faster) |
| Brake / reverse | **Right stick** down |
| Handbrake drift | **Click left stick** |
| Nitro | **Click right stick** |
| Pause / resume | **Hold both sticks clicked** for about 1 second |

| In menus | Controller |
|---|---|
| Move the yellow highlight | Either stick up / down / left / right |
| Select (Play, Retry, Buy…) | **Click right stick** |
| Back | **Click left stick** |
| Garage: previous / next car | Stick left / right |

If steering or throttle goes the wrong way (it depends on how the modules sit in the case), flip
**Invert steering** or **Invert throttle** in Settings. No re-upload is needed.

## Protocol (for your own projects)

The same lines go over USB and Bluetooth:

```
J,<leftX>,<leftY>,<leftButton>,<rightX>,<rightY>,<rightButton>
J,512,518,0,505,20,1        ← example: right stick pushed up + clicked
```

Axes are 0–1023 and buttons are 0/1. Send `h` to get `HELLO,ESCAPE-JOY,2` back.
USB runs at 115200 baud and about 25 lines per second (60 with a 38400-baud HC-05). Bluetooth sends the same lines.
The game-side driver is in `src/joystick.js`.

## Troubleshooting

| Problem | Fix |
|---|---|
| CONNECT shows no ports | Check the USB cable (some are charge-only). On Linux, add yourself to `dialout`. |
| "Failed to open port" | Close the Arduino Serial Monitor or any other program using the port. |
| Car creeps or steers by itself | Re-plug the controller and leave the sticks centred while it calibrates. |
| A direction is reversed | Settings → Invert steering / Invert throttle. |
| Stick clicks do nothing | Check SW wires on D2/D3 and test with `t` in the Serial Monitor. |
| Bluetooth: `No route to host` in the terminal | The HC-05 is off, out of range, or not paired. Power it and check `bluetoothctl info <address>`. |
| Bluetooth: HC-05 LED keeps blinking fast | Not connected. Re-run `sudo rfcomm bind 0 <address> 1` and reload the game. |
| Bluetooth: connected but no movement | TXD/RXD swapped: HC-05 **TXD → D10**. Also check `BT_BAUD` matches the module (9600 default). |
| Bluetooth: laggy | Close other Bluetooth audio devices, or switch the HC-05 to 38400 baud (above). |
