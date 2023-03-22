<template>
  <!-- notification -->
  <v-snackbar
    :model-value="true"
    :timeout="-1"
    :color="player.me.uid==player.lastKill.killer.uid? 'success': 'error'"
    location="top"
    v-if="player.lastKill"
  >
    <div class="d-flex align-center">
      <div>{{ player.lastKill.killer.name }}</div>
      <div class="hud-death-weapon mx-3 my-0">{{ player.lastKill.weaponLetter }}</div>
      <div>{{ player.lastKill.victim.name }}</div>
    </div>
  </v-snackbar>

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
  >
    <v-card class="font-default" style="height:100%; overflow:auto; text-align:left;">
      <div class="d-flex flex-column border" style="height:100%;">
        <div>
          <v-tabs v-model="window1.tab">
            <v-tab value="table"><v-icon>mdi-list-box-outline</v-icon></v-tab>
            <v-tab value="sounds"><v-icon>mdi-volume-medium</v-icon></v-tab>
            <!-- <v-tab value="settings"><v-icon>mdi-cog</v-icon></v-tab> -->
          </v-tabs>
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
                    v-bind="{
                      hideDetails: true,
                      density: 'compact',
                    }"
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

        <!-- Sounds -->
        <div v-if="window1.tab=='settings'" style="flex-grow:1; overflow:auto;">
          Settings
        </div>

        <div class="d-flex" v-if="debug">
          <v-btn block @click="pfnClientCmd(`UpdR 1 0 0`)">UpdR</v-btn>
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
</template>

<script setup>
  import { ref, onMounted } from 'vue';
  import { useIntervalFn, useEventListener, useStorage } from '@vueuse/core';
  import _ from 'lodash';

  import players from '@/assets/players.js';
  import env from '@/assets/env.js';

  import VueDragResize from 'vue-drag-resize';

  window.g_PlayerExtraInfo = window.g_PlayerExtraInfo || players;
  window.CS_ENV = window.CS_ENV || env;
  window.weaponToLetter = window.weaponToLetter || {"p228": 'c', "shield": '', "scout": 'n', "hegrenade": 'h', "grenade": 'h', "xm1014": '', "c4": '', "mac10": '', "aug": 'e', "smokegrenade": 'h', "elite": '', "fiveseven":'c', "ump45":'', "sg550":'A', "galil":'v', "famas":'t', "usp":'c', "glock18":'c', "awp":'r', "mp5navy":'x', "m249":'', "m3":'', "m4a1":'w', "tmp":'', "g3sg1":'', "flashbang":'', "deagle":'f', "sg552":'A', "ak47":'b', "knife":'j', "p90": ''};

  const debug = false;

  const player = ref({
    me: false,
    lastKill: false,
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
        this.lastKill = { headshot, weapon, weaponLetter, killer, victim };
      }

      if (victim.id==this.me.id) {
        this.killedMe[killer.id] = this.killedMe[killer.id] || 0;
        this.killedMe[killer.id] += 1;
        this.lastKill = { headshot, weapon, weaponLetter, killer, victim };
      }
    },
  });

  const window1 = ref({
    tab: 'table',
    bind: useStorage('csh-window1-bind', {
      isActive: true,
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
  });

  const numpads = _.range(1, 9).map(n => `Numpad${n}`);

  const sound = ref({
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
    if (typeof sound.value.sounds[ev.code]=='undefined') return;
    document.activeElement.blur();
    sound.value.play(ev.code);
  });


  const test = ref({
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
        const killer = options.killer ? player.value.getPlayer(options.killer) : _.sample(player.value.list);
        const victim = options.victim ? player.value.getPlayer(options.victim) : _.sample(player.value.list.filter(p => p.uid != killer.uid));
        const weapon = options.weapon ||  _.sample(Object.keys(weaponToLetter));
        const headshot = options.headshot || Math.random() >= .5;

        g_PlayerExtraInfo[ killer.uid ]['frags'] = parseInt(killer.frags) + 1;
        g_PlayerExtraInfo[ victim.uid ]['deaths'] = parseInt(victim.deaths) + 1;
        player.value.countKills(killer.id, victim.id, headshot, weapon);
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
    if (ev.code=='KeyE') test.value.depthTest = true;
  });

  useEventListener(window, 'keyup', (ev) => {
    if (ev.code=='KeyE') test.value.depthTest = false;
  });

  const inputDispatch = (type, key) => {
    const keys = {
      " ": { keyCode: 32, which:32, code: 'Space' },
    };

    const evt = new KeyboardEvent(type, { key, ...(keys[key] || {}) });
    window.dispatchEvent(evt);
    document.dispatchEvent(evt);
    
    const canvas = document.querySelector('#canvas');
    if (canvas) canvas.dispatchEvent(evt);
  };

  const pfnClientCmd = (cmd) => {
    if (typeof Module=='undefined') return;
    return Module.pfnClientCmd(cmd);
  };

  let moduleFound = false;
  const interval = useIntervalFn(() => {
    player.value.loadFromPlayersList();

    if (test.value.depthTest) {
      const canvas = document.querySelector('#canvas');
      if (canvas) {
        let gl = canvas.getContext('webgl');
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.NEVER);
      }
    }

    if (!moduleFound && typeof Module!='undefined') {
      moduleFound = true;

      Module._MsgFunc_DeathMsgJSOld = Module._MsgFunc_DeathMsgJS;
      Module._MsgFunc_DeathMsgJS = function(killer, victim, headshot, truncatedWeaponNamePtr) {
        player.value.countKills(killer, victim, headshot, Pointer_stringify(truncatedWeaponNamePtr));
        Module._MsgFunc_DeathMsgJSOld(killer, victim, headshot, truncatedWeaponNamePtr);
      };

      // Module.printOld = Module.print;
      // Module.print = function(text) {
      //   console.error(text);
      //   Module.printOld(text);
      // };

      
      // Module._MsgFunc_DamageJSOld = Module._MsgFunc_DamageJS;
      // Module._MsgFunc_DamageJS = function(a, b) {
      //   console.clear();
      //   console.log('_MsgFunc_DamageJS', a, b);

      //   const canvas = document.getElementById('canvas');
      //   ['keyup', 'keydown'].forEach(evtName => {
      //     const evt = new KeyboardEvent('keydown', {
      //       key: " ",
      //       keyCode: 32,
      //       code: "Space",
      //       which: 32,
      //       shiftKey: false,
      //       ctrlKey: false,
      //       metaKey: false,
      //     });
          
      //     console.log(evt);
      //     window.dispatchEvent(evt);
      //     document.dispatchEvent(evt);
      
      //     if (canvas) canvas.dispatchEvent(evt);
      //   });

      //   Module._MsgFunc_DamageJSOld(a, b);
      // };


      // Ao tomar dano...
      Module._MsgFunc_HealthJSOld = Module._MsgFunc_HealthJS;
      Module._MsgFunc_HealthJS = function(a, b) {
        console.clear();
        console.log('_MsgFunc_HealthJS', arguments);

        ['keyup', 'keydown'].forEach(evtName => {
          inputDispatch(' ');
        });

        // pfnClientCmd('say ouch!!');
        Module._MsgFunc_HealthJSOld(a, b);
      };


      
      // moduleReplace('print', (text) => {
      //   // console.error(text);
      // });
      
      // _MsgFunc_DeathMsgJS(killer, victim, headshot, truncatedWeaponNamePtr) {},
      // _MsgFunc_RadarJS() {},
      // _DrawZAxisJS2(angle) {},
      // _MsgFunc_HealthJS(health) {},
      // _MsgFunc_DamageJS(health) {},
    }
  }, 10);
</script>