(() => {
  'use strict';
  const weapons = {
    b: 'AK-47',
    d: 'TMP',
    e: 'AUG',
    i: 'T Autosniper Rifle',
    k: 'Shotgun 1',
    l: 'MAC',
    m: 'P90',
    n: 'Scout',
    o: 'CT Autosniper Rifle',
    q: 'UMP',
    r: 'AWP',
    t: 'Famas',
    x: 'MP5',
    z: 'M249',
    A: 'SG-552',
    B: 'Shotgun 2',
    v: 'Galil',
    w: 'M4A1',
  };
  function poll$() {
    const timerId = setTimeout(() => {
      if (typeof $ !== 'undefined') {
        clearTimeout(timerId);
        $(document).on('keydown', (e) => {
          if ($('.hud-spectator').length) return;
          if (e.keyCode === 76) {
            const money = $('.hud-money .hud-value').html();
            const $input = $('.hud-message-input input');
            let weaponChar = '';
            let weapon = '';
            try {
              weaponChar = $($('.hud-weapons').find('.hud-weapon').first()[0]).contents()[0].textContent;
            } catch (e) {}
            let moneyMessage = `$ ${money}`;
            if (weaponChar) {
              weapon = weapons[weaponChar];
            }
            if (weapon) {
              moneyMessage = moneyMessage + ' + ' + weapon;
            }
            $input.data('messagemode', 'messagemode2');
            $input.val(moneyMessage);
            $input.submit();
          }
        });
      } else {
        poll$();
      }
    }, 2000);
  }
  poll$();
})();
