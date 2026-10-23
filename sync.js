// Shared clock for the cue score on GitHub Pages.
// The page asks for window.claude.use("db") / use("user"); this file answers with an
// MQTT-backed stand-in, so the same page code runs here and as a claude.ai artifact.
// The conductor's state is one retained message: {running, t, at}. Everyone connects to
// every broker, so one broker going down does not split the room; the newest `at` wins.
(() => {
  const BROKERS = ["wss://broker.hivemq.com:8884/mqtt", "wss://broker.emqx.io:8084/mqtt"];
  const TOPIC = "breedinglab-score/27c60a0a732e6673/clock";
  const KEY_HASH = "f6f0d4c8fafde6874a4c69c342b2753e78743277227115f410c2822323580563";

  async function sha256(s) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  // ?key=… opens the conductor controls and is remembered on this device; ?key=off forgets it
  const isConductor = (async () => {
    let k = new URLSearchParams(location.search).get("key");
    try {
      if (k === "off") { localStorage.removeItem("cs_key"); k = null; }
      else if (k) localStorage.setItem("cs_key", k);
      else k = localStorage.getItem("cs_key");
    } catch (e) {}
    return !!k && !!(window.crypto && crypto.subtle) && (await sha256(k)) === KEY_HASH;
  })().catch(() => false);

  function connectOne(url) {
    return new Promise((resolve) => {
      const c = mqtt.connect(url, { connectTimeout: 6000, reconnectPeriod: 3000, clientId: "bl_" + Math.random().toString(16).slice(2, 12) });
      const timer = setTimeout(() => { c.end(true); resolve(null); }, 7000);
      c.once("connect", () => { clearTimeout(timer); resolve(c); });
    });
  }
  let clients = null;
  // ready once every broker has answered, or 1.5 s after the first one connects
  const getClients = () => (clients = clients || new Promise((resolve) => {
    const got = [], pending = BROKERS.map(connectOne);
    let left = pending.length, closed = false, grace = null;
    const finish = () => { if (!closed) { closed = true; clearTimeout(grace); resolve(got.slice()); } };
    pending.forEach((p) => p.then((c) => {
      if (c && closed) c.end(true);
      else if (c) { got.push(c); if (!grace) grace = setTimeout(finish, 1500); }
      if (--left === 0) finish();
    }));
  }));

  let last = null;
  const db = {
    doc: () => ({
      async set(d) {
        const cs = await getClients();
        if (!cs.length) throw new Error("offline");
        const msg = JSON.stringify(d);
        cs.forEach((c) => c.publish(TOPIC, msg, { qos: 1, retain: true }));
      },
      onSnapshot(next) {
        getClients().then((cs) => {
          let got = false;
          cs.forEach((c) => {
            c.on("message", (topic, m) => {
              if (topic !== TOPIC) return;
              let d;
              try { d = JSON.parse(m.toString()); } catch (e) { return; }
              if (!d || typeof d.at !== "number" || (last && d.at < last.at)) return;
              if (last && JSON.stringify(d) === JSON.stringify(last)) return;
              last = d; got = true;
              next({ exists: true, data: () => d });
            });
            c.subscribe(TOPIC, { qos: 1 });
          });
          setTimeout(() => { if (!got) next({ exists: false, data: () => undefined }); }, 2000);
        });
        return () => {};
      },
    }),
  };

  window.claude = {
    use: async (name) => {
      if (name === "user") { const ok = await isConductor; return { canEdit: async () => ok }; }
      if (name !== "db" || !window.mqtt) return null;
      return (await getClients()).length ? db : null;
    },
  };
})();
