const appendScript = (options) => {
  return (document.head || document.documentElement).appendChild(
    Object.assign(document.createElement('script'), options)
  );
};

const u = new URL(location.href);

if (['localhost:5180', 'game.play-cs.com'].includes(u.host)) {
  if (!['localhost:5180'].includes(u.host)) {
    appendScript({ src: 'http://localhost:5180/src/main.js', type: 'module' });
  } else {
    // include builded file
  }
}
