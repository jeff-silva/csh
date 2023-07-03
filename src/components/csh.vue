<template>
  <v-defaults-provider
    :defaults="{
      global: {
        rounded: 0,
      },
      VTextField: { density: 'compact', },
      VSelect: { density: 'compact', },
      VTextarea: { density: 'compact', },
    }"
  >
    <!-- target -->
    <div style="position:fixed; top:50%; left:50%; width:0; height:0;">
      <div style="position:absolute; width:5px; height:5px; border:solid 1px #00ff00; border-radius:50%; top:50%; left:50%; transform:translate(-50%, -50%);"></div>
    </div>
  
    <!-- bottom-right -->
    <vue-drag-resize
      v-bind="window1.bind"
      @resizing="window1.onDragResize($event)"
      @dragging="window1.onDragResize($event)"
      style="z-index:9999!important;"
      v-show="!window1.bind.outside && window1.visible"
    >
      <v-card class="font-default" style="height:100%; overflow:auto; text-align:left;">
        <div ref="window1Ref" style="height:100%;">
          <div class="d-flex flex-column" style="height:100%;">
            <div class="d-flex">
              <v-tabs v-model="window1.tab" class="flex-grow-1">
                <v-tab value="table"><v-icon>mdi-list-box-outline</v-icon></v-tab>
                <v-tab value="sounds"><v-icon>mdi-volume-medium</v-icon></v-tab>
                <v-tab value="settings"><v-icon>mdi-cog</v-icon></v-tab>
              </v-tabs>
              <v-btn
                :icon="window1.bind.outside ? 'mdi-window-maximize' : 'mdi-window-restore'"
                variant="text"
                rounded="0"
                @click="window1.toogleOutside()"
              />
            </div>
    
            <!-- Table -->
            <div v-if="window1.tab=='table'" style="flex-grow:1; overflow:auto;">
              <v-table
                density="compact"
                style="font-size:12px;"
                class="border-t"
                v-if="player.enemies.length>0"
              >
                <colgroup>
                  <col>
                  <col width="10px" class="bg-green-lighten-3">
                  <col width="10px" class="bg-red-lighten-3">
                </colgroup>
                <thead>
                  <tr>
                    <th>Your enemies</th>
                    <th>IK</th>
                    <th>KM</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="p in player.enemies"
                  >
                    <td
                      :class="{
                        'bg-amber-lighten-4': p.teamnumber==1,
                        'bg-blue-grey-lighten-2': p.teamnumber==2,
                      }"
                    >
                      {{ p.name }}
                    </td>
                    <td>{{ p.iKilled }}</td>
                    <td>{{ p.killedMe }}</td>
                  </tr>
                </tbody>
              </v-table>
              <v-table density="compact" style="font-size:12px;" class="border-t">
                <colgroup>
                  <col>
                  <col width="10px" class="bg-green-lighten-3">
                  <col width="10px" class="bg-red-lighten-3">
                  <col width="10px" class="bg-green-lighten-3">
                  <col width="10px" class="bg-red-lighten-3">
                </colgroup>
                <thead>
                  <tr class="bg-white">
                    <th>Top killers</th>
                    <th title="Kills">K</th>
                    <th title="Deaths">D</th>
                    <th title="I killed">IK</th>
                    <th title="Killed me">KM</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(p, i) in player.list"
                    :key="p.uid"
                    :class="{
                      'bg-indigo-lighten-4':p.uid==player.me.uid,
                    }"
                  >
                    <td
                      :class="{
                        'bg-amber-lighten-4': p.teamnumber==1,
                        'bg-blue-grey-lighten-2': p.teamnumber==2,
                      }"
                    >
                      {{ i+1 }}º - {{ p.name }}
                    </td>
                    <td>{{ p.frags }}</td>
                    <td>{{ p.deaths }}</td>
                    <td>{{ p.iKilled }}</td>
                    <td>{{ p.killedMe }}</td>
                  </tr>
                </tbody>
              </v-table>
            </div>
    
            <!-- Sounds -->
            <div v-if="window1.tab=='sounds'" style="flex-grow:1; overflow:auto;">
              <!-- https://www.myinstants.com/media/sounds/tome-rodrigo-faro_xDXKGwq.mp3 -->
              <v-table class="border-t">
                <colgroup>
                  <col width="100px">
                  <col width="*">
                  <col width="100px">
                </colgroup>
                <tbody>
                  <tr v-for="(_url, _numpad) in sound.sounds" :key="_numpad">
                    <td>{{ _numpad }}</td>
                    <td>
                      <v-text-field
                        v-model="sound.sounds[_numpad]"
                        @input="sound.loadForced()"
                        v-bind="{ hideDetails: true }"
                      />
                    </td>
                    <td class="pa-0">
                      <v-btn
                        block
                        rounded="0"
                        icon="mdi-play"
                        size="x-small"
                        @click="sound.play(_numpad)"
                      />
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
  
            <div v-if="window1.tab=='settings'" class="pa-2" style="flex-grow:1; overflow:auto;">
              <v-textarea v-bind="{ label: 'Watch players online' }" />
              <v-textarea v-bind="{ label: 'Phrases when died' }" />
            </div>
    
            <div class="d-flex" v-if="debug">
              <v-btn block @click="pfnClientCmd(`UpdR 1 0 0`)">UpdR</v-btn>
            </div>

            <div>
              <v-alert v-if="player.lastVictim" type="success">
                <div class="d-flex align-center">
                  <div>{{ player.lastVictim.killer.name }}</div>
                  <div class="hud-death-weapon mx-3 my-0">{{ player.lastVictim.weaponLetter }}</div>
                  <div>{{ player.lastVictim.victim.name }}</div>
                </div>
              </v-alert>
              <v-alert v-if="player.lastKiller" type="error">
                <div class="d-flex align-center">
                  <div>{{ player.lastKiller.killer.name }}</div>
                  <div class="hud-death-weapon mx-3 my-0">{{ player.lastKiller.weaponLetter }}</div>
                  <div>{{ player.lastKiller.victim.name }}</div>
                </div>
              </v-alert>
            </div>
          </div>
        </div>
      </v-card>
    </vue-drag-resize>
  
    <!-- debug -->
    <v-card v-if="debug" style="position:fixed; z-index:999!important; bottom:15px; left:15px; max-height:400px; overflow:auto; text-align:left;">
      <v-btn block @click="test.simulateKills()">test.simulateKills()</v-btn>
      <v-btn block @click="test.simulateMyKills()">test.simulateMyKills()</v-btn>
      <v-btn block @click="test.simulateMyDeaths()">test.simulateMyDeaths()</v-btn>
      <v-btn block @click="pfnClientCmd('say hello world')">pfnClientCmd()</v-btn>
      <pre>player.enemies: {{ player.enemies }}</pre>
    </v-card>
  </v-defaults-provider>
</template>

<script setup>
  import { ref, reactive, onMounted, onUnmounted } from 'vue';
  import { useIntervalFn, useEventListener, useStorage } from '@vueuse/core';
  import _ from 'lodash';
  import hotkeys from 'hotkeys-js';

  import players from '@/assets/players.js';
  import env from '@/assets/env.js';

  import VueDragResize from 'vue-drag-resize';

  window.g_PlayerExtraInfo = window.g_PlayerExtraInfo || players;
  window.CS_ENV = window.CS_ENV || env;
  window.weaponToLetter = window.weaponToLetter || {"p228": 'c', "shield": '', "scout": 'n', "hegrenade": 'h', "grenade": 'h', "xm1014": '', "c4": '', "mac10": '', "aug": 'e', "smokegrenade": 'h', "elite": '', "fiveseven":'c', "ump45":'', "sg550":'A', "galil":'v', "famas":'t', "usp":'c', "glock18":'c', "awp":'r', "mp5navy":'x', "m249":'', "m3":'', "m4a1":'w', "tmp":'', "g3sg1":'', "flashbang":'', "deagle":'f', "sg552":'A', "ak47":'b', "knife":'j', "p90": ''};

  const debug = false;

  const player = reactive({
    me: false,
    lastKiller: false,
    lastVictim: false,
    iKilled: {},
    killedMe: {},
    enemies: [],
    list: [],
    getPlayer(id) {
      id = id=='me' ? this.me.uid : id;
      return this.list.filter(p => p.id==id || p.uid==id).at(0) || false;
    },
    loadFromPlayersList() {
      this.list = Object.entries(g_PlayerExtraInfo)
        .map(([uid, player]) => {
          const me = uid == CS_ENV.myXashId;
          const iKilled = this.iKilled[ player.id ] || 0;
          const killedMe = this.killedMe[ player.id ] || 0;
          player.frags = parseInt(player.frags) || 0;
          player.deaths = parseInt(player.deaths) || 0;
          return { uid, me, ...player, iKilled, killedMe };
        })
        .filter(player => {
          return !!player.name;
        })
        .sort((a, b) => {
          if (a.frags > b.frags) { return -1; }
          if (a.frags < b.frags) { return 1; }
          return 0;
        });

      this.me = this.list.filter(player => player.me==true).at(0) || false;

      this.enemies = _.slice(this.list
        .filter((p, i) => {
          return (
            p.teamnumber != this.me.teamnumber
            && p.killedMe > 0
          );
        })
        .sort((a, b) => {
          if (a.killedMe > b.killedMe) { return -1; }
          if (a.killedMe < b.killedMe) { return 1; }
          return 0;
        }), 0, 3);
    },
    countKills(killer, victim, headshot, weapon) {
      killer = this.getPlayer(killer);
      victim = this.getPlayer(victim);

      let [, weaponLetter] = weapon.split('_');
      if (typeof weaponToLetter=='object') {
        weaponLetter = weaponToLetter[ weaponLetter ] || false;
      }
      
      if (killer.id==this.me.id) {
        this.iKilled[victim.id] = this.iKilled[victim.id] || 0;
        this.iKilled[victim.id] += 1;
        this.lastVictim = { headshot, weapon, weaponLetter, killer, victim };
      }

      if (victim.id==this.me.id) {
        this.killedMe[killer.id] = this.killedMe[killer.id] || 0;
        this.killedMe[killer.id] += 1;
        this.lastKiller = { headshot, weapon, weaponLetter, killer, victim };
      }
    },
  });

  hotkeys('ctrl+e', (ev, handler) => {
    ev.preventDefault();
    window1.visible = !window1.visible;
  });

  const window1Ref = ref(null);
  const window1 = reactive({
    visible: false,
    tab: 'table',
    bind: useStorage('csh-window1-bind', {
      isActive: true,
      outside: false,
      w: 300,
      h: 500,
      y: 15,
      x: 15,
    }),
    onDragResize(pos) {
      this.bind.w = pos.width;
      this.bind.h = pos.height;
      this.bind.y = pos.top;
      this.bind.x = pos.left;
    },
    win: false,
    toogleOutside(outside=null) {
      this.bind.outside = outside===null ? !this.bind.outside : outside;

      // Move content from in to outside
      if (this.bind.outside) {
        if (this.win) {
          this.win.focus();
        } else {
          this.win = window.open("", "", `popup=1,width=${this.bind.w},height=${this.bind.h},top=${this.bind.y},left=${this.bind.x},scrollbars=1,resizable=1`);
          this.win.onbeforeunload = () => { this.toogleOutside(false); };
          this.win.document.body.appendChild(Object.assign(document.createElement('div'), {
            id: 'fragment',
          }));
          
          // console.log(window1Ref.value.firstChild);

          let fragment = new DocumentFragment();
          fragment.appendChild(window1Ref.value.firstChild);
          this.win.document.querySelector('#fragment').appendChild(fragment);

          document.querySelectorAll('style').forEach(elem => {
            this.win.document.head.appendChild(Object.assign(document.createElement('style'), {
              innerHTML: elem.innerHTML,
            }));
          });
          
          document.querySelectorAll('link[href]').forEach(elem => {
            this.win.document.head.appendChild(Object.assign(document.createElement('link'), {
              rel: elem.rel,
              href: elem.href,
            }));
          });
        }
      }

      // Move content from out to inside
      else {
        if (this.win) {
          const frag = this.win.document.querySelector('#fragment');
          if (frag && frag.firstChild) {
            let fragment = new DocumentFragment();
            fragment.appendChild(frag.firstChild);
            window1Ref.value.appendChild(fragment);
          }
          this.win.close();
          this.win = false;
        }
      }
    },
  });

  onMounted(() => {
    if (window1.bind.outside) {
      window1.toogleOutside(true);
    }
  });

  onUnmounted(() => {
    if (window1.win) {
      window1.win.close();
    }
  });

  useEventListener(window, 'beforeunload', (ev) => {
    window1.win.close();
  });

  const input = {
    keyboard: {
      keyboardEvents: {
        "Space": {"keyCode": 32, "which": 32, "key": " "},
        "Numpad0": {"keyCode": 96, "which": 96, "key": "0"},
        "Numpad1": {"keyCode": 97, "which": 97, "key": "1"},
        "Numpad2": {"keyCode": 98, "which": 98, "key": "2"},
        "Numpad3": {"keyCode": 99, "which": 99, "key": "3"},
        "Numpad4": {"keyCode": 100, "which": 100, "key": "4"},
        "Numpad5": {"keyCode": 101, "which": 101, "key": "5"},
        "Numpad6": {"keyCode": 102, "which": 102, "key": "6"},
        "Numpad7": {"keyCode": 103, "which": 103, "key": "7"},
        "Numpad8": {"keyCode": 104, "which": 104, "key": "8"},
        "Numpad9": {"keyCode": 105, "which": 105, "key": "9"},
        "Digit0": {"keyCode": 48, "which": 48, "key": "0"},
        "Digit1": {"keyCode": 49, "which": 49, "key": "1"},
        "Digit2": {"keyCode": 50, "which": 50, "key": "2"},
        "Digit3": {"keyCode": 51, "which": 51, "key": "3"},
        "Digit4": {"keyCode": 52, "which": 52, "key": "4"},
        "Digit5": {"keyCode": 53, "which": 53, "key": "5"},
        "Digit6": {"keyCode": 54, "which": 54, "key": "6"},
        "Digit7": {"keyCode": 55, "which": 55, "key": "7"},
        "Digit8": {"keyCode": 56, "which": 56, "key": "8"},
        "Digit9": {"keyCode": 57, "which": 57, "key": "9"},
        "KeyA": {"keyCode": 65, "which": 65, "key": "a"},
        "KeyB": {"keyCode": 66, "which": 66, "key": "b"},
        "KeyC": {"keyCode": 67, "which": 67, "key": "c"},
        "KeyD": {"keyCode": 68, "which": 68, "key": "d"},
        "KeyE": {"keyCode": 69, "which": 69, "key": "e"},
        "KeyF": {"keyCode": 70, "which": 70, "key": "f"},
        "KeyG": {"keyCode": 71, "which": 71, "key": "g"},
        "KeyH": {"keyCode": 72, "which": 72, "key": "h"},
        "KeyI": {"keyCode": 73, "which": 73, "key": "i"},
        "KeyJ": {"keyCode": 74, "which": 74, "key": "j"},
        "KeyK": {"keyCode": 75, "which": 75, "key": "k"},
        "KeyL": {"keyCode": 76, "which": 76, "key": "l"},
        "KeyM": {"keyCode": 77, "which": 77, "key": "m"},
        "KeyN": {"keyCode": 78, "which": 78, "key": "n"},
        "KeyO": {"keyCode": 79, "which": 79, "key": "o"},
        "KeyP": {"keyCode": 80, "which": 80, "key": "p"},
        "KeyQ": {"keyCode": 81, "which": 81, "key": "q"},
        "KeyR": {"keyCode": 82, "which": 82, "key": "r"},
        "KeyS": {"keyCode": 83, "which": 83, "key": "s"},
        "KeyT": {"keyCode": 84, "which": 84, "key": "t"},
        "KeyU": {"keyCode": 85, "which": 85, "key": "u"},
        "KeyV": {"keyCode": 86, "which": 86, "key": "v"},
        "KeyW": {"keyCode": 87, "which": 87, "key": "w"},
        "KeyX": {"keyCode": 88, "which": 88, "key": "x"},
        "KeyY": {"keyCode": 89, "which": 89, "key": "y"},
        "KeyZ": {"keyCode": 90, "which": 90, "key": "z"},
        "ArrowUp": {"keyCode": 38, "which": 38, "key": "ArrowUp"},
        "ArrowDown": {"keyCode": 40, "which": 40, "key": "ArrowDown"},
        "ArrowLeft": {"keyCode": 37, "which": 37, "key": "ArrowLeft"},
        "ArrowRight": {"keyCode": 39, "which": 39, "key": "ArrowRight"},
      },
      dispatch(type, key) {
        if (!this.keyboardEvents[key]) return;
        const evt = new KeyboardEvent(type, { key, ...(this.keyboardEvents[key] || {}) });
        window.dispatchEvent(evt);
        document.dispatchEvent(evt);
        
        const canvas = document.querySelector('#canvas');
        if (canvas) canvas.dispatchEvent(evt);
      },
      press(key, miliseconds, callbackEnd=null) {
        this.dispatch('keydown', key);
        setTimeout(() => {
          this.dispatch('keyup', key);
          if (typeof callbackEnd=='function') {
            callbackEnd();
          }
        }, miliseconds);
      },
    },
  };

  const numpads = _.range(1, 9).map(n => `Numpad${n}`);

  const sound = reactive({
    sounds: useStorage('csh-sounds', {
      Numpad1: '',
      Numpad2: '',
      Numpad3: '',
      Numpad4: '',
      Numpad5: '',
      Numpad6: '',
      Numpad7: '',
      Numpad8: '',
      Numpad9: '',
    }),
    audios: {},
    loadForced() {
      this.audios = {};
      this.load();
    },
    load() {
      Object.entries(this.sounds).forEach(([ num, url ]) => {
        if (this.audios[num]) return;
        if (!this.sounds[num]) return;
        this.audios[num] = Object.assign(new Audio(url), {
          volume: parseFloat(window.CS_ENV.my_cvars.volume),
        });
      });
    },
    play(num) {
      this.load();
      if (!this.audios[num]) return;
      this.audios[num].play();
    }
  });

  useEventListener(document, 'keydown', (ev) => {
    if (typeof sound.sounds[ev.code]=='undefined') return;
    document.activeElement.blur();
    sound.play(ev.code);
  });


  const test = reactive({
    depthTest: false,
    removeUser() {
      const key = Object.keys(g_PlayerExtraInfo).at(0);
      delete g_PlayerExtraInfo[key];
    },
    simulateKills(options={}) {
      options = _.merge({
        killer: null,
        victim: null,
        weapon: null,
        headshot: null,
        times: 1,
      }, options);

      for(let i=0; i<options.times; i++) {
        const killer = options.killer ? player.getPlayer(options.killer) : _.sample(player.list);
        const victim = options.victim ? player.getPlayer(options.victim) : _.sample(player.list.filter(p => p.uid != killer.uid));
        const weapon = options.weapon ||  _.sample(Object.keys(weaponToLetter));
        const headshot = options.headshot || Math.random() >= .5;

        g_PlayerExtraInfo[ killer.uid ]['frags'] = parseInt(killer.frags) + 1;
        g_PlayerExtraInfo[ victim.uid ]['deaths'] = parseInt(victim.deaths) + 1;
        player.countKills(killer.id, victim.id, headshot, weapon);
      }
    },
    simulateMyKills(options) {
      return this.simulateKills({ ...options, killer: 'me' });
    },
    simulateMyDeaths(options) {
      return this.simulateKills({ ...options, victim: 'me' });
    },
  });

  useEventListener(window, 'keydown', (ev) => {
    if (ev.code=='KeyE') test.depthTest = true;
  });

  useEventListener(window, 'keyup', (ev) => {
    if (ev.code=='KeyE') test.depthTest = false;
  });

  const pfnClientCmd = (cmd) => {
    if (typeof Module=='undefined') return;
    return Module.pfnClientCmd(cmd);
  };

  // Module replace
  const ModuleReplace = {
    print: function(text) {
      ['OnServerRoundsEnd'].forEach(evt => {
        searchCB(text, evt, function() {
          player.iKilled = {};
          player.killedMe = {};
        });
      });
    },
    _MsgFunc_DeathMsgJS: function(killer, victim, headshot, truncatedWeaponNamePtr) {
      player.countKills(killer, victim, headshot, Pointer_stringify(truncatedWeaponNamePtr));
    },
    _MsgFunc_HealthJS: function(a, b, c) {
      // input.keyboard.press('Space', 500);
      // input.keyboard.press('KeyC', 500);
      // input.keyboard.press(Math.random()>.5 ? 'KeyA' : 'KeyD', 500);
    },
  };

  let moduleFound = false;
  const interval = useIntervalFn(() => {
    player.loadFromPlayersList();

    if (test.depthTest) {
      const canvas = document.querySelector('#canvas');
      if (canvas) {
        let gl = canvas.getContext('webgl');
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.NEVER);
      }
    }

    if (!moduleFound && typeof Module!='undefined') {
      moduleFound = true;

      if (!window.cshModuleReplaced) {
        window.cshModuleReplaced = true;
        for(let attr in Module) {
          if (typeof Module[attr]=='function') {
            const oldMethod = Module[attr];
            Module[attr] = function() {
              if (typeof ModuleReplace[attr]=='function') {
                ModuleReplace[attr].apply(Module, arguments);
              }
              oldMethod.apply(Module, arguments);
            };
          }
        }
      }
    }
  }, 10);
</script>