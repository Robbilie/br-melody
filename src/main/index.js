import { createComponent, RECEIVE_PROPS } from 'melody-component';
import { bindEvents } from 'melody-hoc';
import template from './index.twig';

////////// ACTIONS //////////

const 
  ADD_SOURCE = 'ADD_SOURCE',
  REMOVE_SOURCE = 'REMOVE_SOURCE',
  MODIFY_SOURCE = 'MODIFY_SOURCE',
  MOVE_TEAM = 'MOVE_TEAM',
  SET_TEAMS = 'SET_TEAMS',
  SET_KILLMAILS = 'SET_KILLMAILS',
  SET_IDTONAME = 'SET_IDTONAME',
  ADD_KILLMAILS = 'ADD_KILLMAILS',
  SET_PLAYERS = 'SET_PLAYERS';

const addSource = (payload = { type: "system", value: "", id: -1, start: new Date().toISOString().split(".")[0], end: new Date().toISOString().split(".")[0] }) => ({ type: ADD_SOURCE, payload });
const removeSource = (payload) => ({ type: REMOVE_SOURCE, payload });
const modifySource = (payload) => ({ type: MODIFY_SOURCE, payload });
const setKillmails = (payload) => ({ type: SET_KILLMAILS, payload });
const setIdToName = (payload) => ({ type: SET_IDTONAME, payload });
const setTeams = (payload) => ({ type: SET_TEAMS, payload });
const setPlayers = (payload) => ({ type: SET_PLAYERS, payload });
const moveTeam = (payload) => ({ type: MOVE_TEAM, payload });

////////// REDUCERS //////////

//const initialState = { sourceIndex: 1, sources: [Object.assign(addSource().payload, { index: 0 })], killmails: [], teams: [], players: [], idToName: {} };
const initialState = { sourceIndex: 1, sources: [{ type: "system", value: "30005189", id: -1, start: "2017-10-11T10:07", end: "2017-10-11T15:37", index: 1 }], killmails: [], teams: [], players: [], idToName: {} };

const stateReducer = (state = initialState, action) => {
  switch(action.type) {
    case RECEIVE_PROPS:
      return {
        ...state,
        ...action.payload
      };
    case ADD_SOURCE:
      const index = state.sourceIndex;
      return {
        ...state,
        sourceIndex: index + 1,
        sources: [...state.sources, { ...action.payload, index }]
      };
    case REMOVE_SOURCE:
      return {
        ...state,
        sources: state.sources.filter(({ index }) => index !== action.payload)
      };
    case MODIFY_SOURCE:
      return {
        ...state,
        sources: state.sources.map(source => source.index == action.payload.index ? { ...source, [action.payload.key]: action.payload.value } : source)
      };
    case SET_KILLMAILS:
      return {
        ...state,
        killmails: action.payload
      };
    case SET_IDTONAME:
      return {
        ...state,
        idToName: action.payload
      };
    case SET_TEAMS:
      return {
        ...state,
        teams: action.payload
      };
    case SET_PLAYERS:
      return {
        ...state,
        players: action.payload
      };
    case MOVE_TEAM:
      const currentIndex = state.teams.findIndex(team => team.includes(action.payload.id));
      const newIndex = Math.max(currentIndex + action.payload.direction, 0);
      const teams = state.teams.map(team => team.filter(id => id !== action.payload.id));
      if (!teams[newIndex])
        teams[newIndex] = [];
      teams[newIndex].push(action.payload.id);
      return {
        ...state,
        teams
      };
  }
  return state;
};

////////// METHODS //////////

const load = async (sources) => [].concat(...(await Promise.all(sources.map(source => loadSource(source)))));

const loadSource = ({ type, value, start, end }) => loadKillmails({ type, id: value, start: start.replace(/-|:|T/g, "").slice(0, 10) + "00", end: end.replace(/-|:|T/g, "").slice(0, 10) + "00" });

const loadKillmails = async (params, start = params.start, totalPages = 0) => {
  const data = await fetchPages(Object.assign(params, { start, totalPages }));
  if (data.length !== 0 && data.length === 200 * 10) {
    //const lastKillmail = data.slice(-1)[0];
    //const killmails = await loadKillmails(params, lastKillmail.killmail_time.replace(/:|-| |T/g,'').substring(0, 10) + "00", totalPages + 10);
    //const lastKillIndex = killmails.findIndex(({ killmail_id }) => killmail_id === lastKillmail.killmail_id);
    //return data.concat(killmails.slice(lastKillIndex + 1));
    return data.concat(await loadKillmails(params, data.slice(-1)[0].killmail_time.replace(/:|-| |T/g,'').substring(0, 10) + "00", totalPages + 10));
  } else {
    return data;
  }
};

const fetchPages = async (params, page = 1) => {
  const data = await json(url(Object.assign(params, { page })));
  if (page !== 10 && data.length === 200)
    return data.concat(await fetchPages(params, ++page));
  else
    return data;
};

const url = ({ type, id, start, end, page }) => `https://zkillboard.com/api/kills/${type == "system" ? "solarSystemID" : "bla"}/${id}/startTime/${start}/endTime/${end}/page/${page}/`;

const json = (...args) => fetch(...args).then(res => res.json());

const getTeams = killmails => [...new Set([].concat(...killmails
  .map(({ victim, attackers}) => []
    .concat(...attackers.map(attacker => attacker.alliance_id || attacker.corporation_id || []))
    .concat(victim.alliance_id || victim.corporation_id || [])
  )))
];

//const getPlayers = killmails => [...new Set([].concat(...killmails
  //.map(({ victim, attackers }) => []
    //.concat(...attackers.map(attacker => attacker.character_id || []))
    //.concat(victim.character_id || [])
const getPlayers = killmails => [...new Map([].concat(...killmails
  .map(({ victim: { character_id, corporation_id, alliance_id }, attackers }) => []
    .concat(...attackers.map(({ character_id, corporation_id, alliance_id }) => character_id ? { character_id, corporation_id, alliance_id } : []))
    .concat(character_id ? { character_id, corporation_id, alliance_id } : [])
  )
).map(player => [player.character_id || player.corporation_id, player])).values()];

const toMap = (arr, key, value) => new Map(arr.map(el => [el[key], el[value]]));

const chunkedJson = (url, ids, size) => Promise.all(ids.chunk(size).map(chunk => json(url + chunk.join()))).then(chunks => [].concat(...chunks));

Object.defineProperty(Array.prototype, 'chunk', {
  value: function(chunkSize) {
    let R = [];
    for (let i = 0; i < this.length; i += chunkSize)
      R.push(this.slice(i, i + chunkSize));
    return R;
  }
});

////////// HANDLERS //////////

const withClickHandlers = bindEvents({
  addSourceButton: {
    click (event, { dispatch }) {
      dispatch(addSource());
    }
  },
  analyzeButton: {
    async click (event, { dispatch, getState }) {
      const START = Date.now()

      console.log(getState())

      let killmails = [...new Map((await load(getState().sources))
        .map(killmail => [killmail.killmail_id, killmail])).values()];

      console.log(killmails)
      console.log([].concat(...killmails.map(({ victim, attackers }) => [victim].concat(attackers))))
      const { characterIDs, corporationIDs, allianceIDs } = [].concat(...killmails.map(({ victim, attackers }) => [victim].concat(attackers))).reduce((p, { character_id, corporation_id, alliance_id }) => {
        if (character_id)
          p.characterIDs.add(character_id);
        if (corporation_id)
          p.corporationIDs.add(corporation_id);
        if (alliance_id)
          p.allianceIDs.add(alliance_id);
        return p;
      }, { characterIDs: new Set(), corporationIDs: new Set(), allianceIDs: new Set() });

      const idToName = {};
      new Map([
        ...toMap(await chunkedJson("https://esi.tech.ccp.is/v1/characters/names/?character_ids=", Array.from(characterIDs), 100), "character_id", "character_name"), 
        ...toMap(await chunkedJson("https://esi.tech.ccp.is/v1/corporations/names/?corporation_ids=", Array.from(corporationIDs), 100), "corporation_id", "corporation_name"), 
        ...toMap(await chunkedJson("https://esi.tech.ccp.is/v1/alliances/names/?alliance_ids=", Array.from(allianceIDs), 100), "alliance_id", "alliance_name")
      ]).forEach((value, key) => idToName[key] = value);


      dispatch(setIdToName(idToName));
      dispatch(setKillmails(killmails));
      dispatch(setTeams([getTeams(killmails)]));
      dispatch(setPlayers(getPlayers(killmails)));

      console.log(getState())

      console.log((Date.now() - START) / 1000);
    }
  },
  removeSourceButton: {
    click (event, { dispatch }) {
      dispatch(removeSource(event.target.parentElement.dataset.key - 0));
    }
  },
  sourceAttribute: {
    change (event, { dispatch }) {
      dispatch(modifySource({
        index: event.target.parentElement.dataset.key - 0,
        key: event.target.getAttribute("data-name"),
        value: event.target.value
      }));
    }
  },
  moveTeamLeftButton: {
    click (event, { dispatch }) {
      dispatch(moveTeam({ id: event.target.parentNode.dataset.key - 0 , direction: -1 }));
    }
  },
  moveTeamRightButton: {
    click (event, { dispatch, getState }) {
      dispatch(moveTeam({ id: event.target.parentNode.dataset.key - 0 , direction: 1 }));
    }
  }
});

export default withClickHandlers(createComponent(template, stateReducer));