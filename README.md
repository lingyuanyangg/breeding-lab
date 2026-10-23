# BREEDING LAB · Cue Score

Mobile cue score for the 6 Lab Technicians of BREEDING LAB (10-minute version, rehearsal marks A–I).

https://lingyuanyangg.github.io/breeding-lab/

## Shared clock

Everyone who opens the page follows one timeline. The conductor opens the page once with `?key=<conductor key>`; that device then shows Start / Pause / ±5 and its rehearsal-mark and overview taps move everyone. Other devices only follow, and can switch to a local practice clock by tapping **SYNCED**. `?key=off` removes the conductor role from a device.

The clock state is a single retained MQTT message (`{running, t, at}`) on the public brokers HiveMQ and EMQX. Each phone works out the current time from its own system clock, so phones agree to within a fraction of a second. The public brokers have no access control: the conductor key only hides the controls.

## Files

- `index.html`: built from the English claude.ai artifact page by `build.py` in the project (`notation/cue_score/site/`). Edit the sources there and rebuild rather than editing these.
- `sync.js`: the MQTT clock.
- `mqtt.min.js`: [MQTT.js](https://github.com/mqttjs/MQTT.js) 5.10.1, MIT licence.
