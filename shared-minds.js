// shared-minds.js
// Floating week circles that bounce around the screen (vanilla JS).

(() => {
  // Configure your weeks here. Use RELATIVE hrefs for Live Server.
  const weeks = [
    { label: 'Week 1', href: 'week1/index.html', size: 100, bg: '#111', color: '#fff', speed: 2 },
    // Add more weeks like:
    { label: 'Week 2', href: 'week2/index.html', size: 90, bg: '#222', color: '#fff', speed: 2.2 },
    { label: 'Week 3', href: 'week3/index.html', size: 95, bg: '#333', color: '#fff', speed: 1.8 },
    { label: 'Week 4', href: 'week4/index.html', size: 110, bg: '#444', color: '#fff', speed: 2.5 },
    { label: 'Week 9', href: 'week9/index.html', size: 85, bg: '#555', color: '#fff', speed: 2.1 },
  ];

  const circles = [];

  function createCircle(cfg) {
    const a = document.createElement('a');
    a.textContent = cfg.label;
    a.href = cfg.href; // relative path for dev servers

    const size = cfg.size || 100;
    Object.assign(a.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: size + 'px',
      height: size + 'px',
      borderRadius: '50%',
      background: cfg.bg || '#111',
      color: cfg.color || '#fff',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'sans-serif',
      fontSize: Math.max(12, Math.floor(size / 6)) + 'px',
      textDecoration: 'none',
      zIndex: '9999',
      userSelect: 'none',
      boxShadow: '0 6px 24px rgba(0,0,0,0.12)'
    });

    document.body.appendChild(a);

    // Random start position & direction
    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = Math.max(0, Math.random() * (w - size));
    const y = Math.max(0, Math.random() * (h - size));
    const angle = Math.random() * Math.PI * 2;
    const speed = cfg.speed || 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    return { el: a, x, y, vx, vy, size };
  }

  // Create all circles
  weeks.forEach(cfg => circles.push(createCircle(cfg)));

  // Animation loop
  function animate() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    for (const c of circles) {
      c.x += c.vx;
      c.y += c.vy;

      if (c.x <= 0 || c.x + c.size >= w) c.vx *= -1;
      if (c.y <= 0 || c.y + c.size >= h) c.vy *= -1;

      c.el.style.left = c.x + 'px';
      c.el.style.top = c.y + 'px';
    }

    requestAnimationFrame(animate);
  }

  animate();
})();