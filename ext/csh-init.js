const appendAsset = (tag, options) => {
  return (document.head || document.documentElement).appendChild(
    Object.assign(document.createElement(tag), options)
  );
};

const u = new URL(location.href);

if (['localhost:5180', 'game.play-cs.com'].includes(u.host)) {
  if (!['localhost:5180'].includes(u.host)) {
    appendAsset('link', {
      rel: 'stylesheet',
      href: chrome.runtime.getURL('dist/assets/index-839faf21.css'),
    });

    appendAsset('script', {
      src: 'http://localhost:5180/src/main.js',
      type: 'module',
      onerror: (ev) => {
        appendAsset('script', {
          src: chrome.runtime.getURL('dist/assets/index-db68f54c.js'),
          type: 'module',
        });
      },
    });
  }
}