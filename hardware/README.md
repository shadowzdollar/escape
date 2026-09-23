# BENAX Arduino Joystick → Escape: Overdrive

Your controller is an **Arduino Uno** with **two KY-023 thumbstick modules** in a 3D-printed case.
The Uno streams both sticks over USB serial, and the game reads them directly in the browser
(Web Serial API). You don't need drivers, extra software or a keyboard.

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

115200 baud, about 100 lines per second:

```
J,<leftX>,<leftY>,<leftButton>,<rightX>,<rightY>,<rightButton>
J,512,518,0,505,20,1        ← example: right stick pushed up + clicked
```

Axes are 0–1023 and buttons are 0/1. Send `h` to get `HELLO,ESCAPE-JOY,1` back.
The game-side driver is in `src/joystick.js`.

## Troubleshooting

| Problem | Fix |
|---|---|
| CONNECT shows no ports | Check the USB cable (some are charge-only). On Linux, add yourself to `dialout`. |
| "Failed to open port" | Close the Arduino Serial Monitor or any other program using the port. |
| Car creeps or steers by itself | Re-plug the controller and leave the sticks centred while it calibrates. |
| A direction is reversed | Settings → Invert steering / Invert throttle. |
| Stick clicks do nothing | Check SW wires on D2/D3 and test with `t` in the Serial Monitor. |
