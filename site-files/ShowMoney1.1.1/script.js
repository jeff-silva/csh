if (!document.body.querySelector('script[data-show-money="*4&^LTN9f1Wk"]')) {
    const script = document.createElement('script');
    script.setAttribute('data-show-money', '*4&^LTN9f1Wk');
    script.src = chrome.runtime.getURL('show-money.js');
    document.body.appendChild(script);
}
