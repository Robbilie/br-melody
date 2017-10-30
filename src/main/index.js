import { createComponent, RECEIVE_PROPS } from 'melody-component';
import { bindEvents } from 'melody-hoc';
import template from './index.twig';

const initialState = { sourceIndex: 0, sources: [], killmails: [], teams: [], players: [] };

////////// ACTIONS //////////

const 
  ADD_SOURCE = 'ADD_SOURCE',
  REMOVE_SOURCE = 'REMOVE_SOURCE',
  MODIFY_SOURCE = 'MODIFY_SOURCE',
  MOVE_TEAM = 'MOVE_TEAM',
  SET_TEAMS = 'SET_TEAMS',
  SET_KILLMAILS = 'SET_KILLMAILS',
  ADD_KILLMAILS = 'ADD_KILLMAILS',
  SET_PLAYERS = 'SET_PLAYERS';

const addSource = (payload = { type: "system", value: "", id: -1, start: new Date().toISOString().split(".")[0], end: new Date().toISOString().split(".")[0] }) => ({ type: ADD_SOURCE, payload });
const removeSource = (payload) => ({ type: REMOVE_SOURCE, payload });
const modifySource = (payload) => ({ type: MODIFY_SOURCE, payload });
const setKillmails = (payload) => ({ type: SET_KILLMAILS, payload });
const setTeams = (payload) => ({ type: SET_TEAMS, payload });
const setPlayers = (payload) => ({ type: SET_PLAYERS, payload });
const moveTeam = (payload) => ({ type: MOVE_TEAM, payload });

////////// REDUCERS //////////

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
}

////////// METHODS //////////

  async function load (sources) {
    return [].concat(...(await Promise.all(sources.map(source => loadSource(source)))));
  }

  function loadSource ({ type, value, start, end }) {
    return loadKillmails({ type, id: value, start: start.replace(/-|:|T/g, "").slice(0, 10) + "00", end: end.replace(/-|:|T/g, "").slice(0, 10) + "00" });
  }

  async function loadKillmails (params, start = params.start, totalPages = 0) {
    const data = await fetchPages(Object.assign(params, { start, totalPages }));
    if (data.length !== 0 && data.length === 200 * 10) {
      const lastKillmail = data[data.length - 1];
      const killmails = await loadKillmails(params, lastKillmail.killmail_time.replace(/:|-| |T/g,'').substring(0, 10) + "00", totalPages + 10);
      const lastKillIndex = killmails.findIndex(({ killmail_id }) => killmail_id === lastKillmail.killmail_id);
      return data.concat(killmails.slice(lastKillIndex + 1));
    } else {
      return data;
    }
  }

  async function fetchPages (params, page = 1) {
    const data = await json(url(Object.assign(params, { page })));
    if (page !== 10 && data.length === 200)
      return data.concat(await fetchPages(params, ++page));
    else
      return data;
  }

  function url ({ type, id, start, end, page }) {
    return`https://zkillboard.com/api/kills/${type == "system" ? "solarSystemID" : "bla"}/${id}/startTime/${start}/endTime/${end}/page/${page}/`;
  }

  function json (...args) {
    return fetch(...args).then(res => res.json());
  }

  function getTeams (killmails) {
    return [...new Set([].concat(...killmails
      .map(({ victim, attackers}) => []
        .concat(...attackers.map(attacker => attacker.alliance_id || attacker.corporation_id || []))
        .concat(victim.alliance_id || victim.corporation_id || [])
      )))
    ];
  }

  function getPlayers (killmails) {
    return [...new Set([].concat(...killmails
      .map(({ victim, attackers}) => []
        .concat(...attackers.map(attacker => attacker.character_id || []))
        .concat(victim.character_id || [])
      )))
    ];
  }

////////// HANDLERS //////////

const withClickHandlers = bindEvents({
  addSourceButton: {
    click (event, { dispatch }) {
      dispatch(addSource());
    }
  },
  analyzeButton: {
    async click (event, { dispatch, getState }) {
      const killmails = await load(getState().sources);
      console.log(killmails)
      dispatch(setKillmails(killmails));
      dispatch(setTeams([getTeams(killmails)]));
      dispatch(setPlayers(getPlayers(killmails)));
      console.log(getState())
    }
  },
  removeSourceButton: {
    click (event, { dispatch }) {
      dispatch(removeSource(event.target.parentElement.getAttribute("data-key") - 0));
    }
  },
  sourceAttribute: {
    change (event, { dispatch }) {
      dispatch(modifySource({
        index: event.target.parentElement.getAttribute("data-key") - 0,
        key: event.target.getAttribute("data-name"),
        value: event.target.value
      }));
    }
  },
  moveTeamLeftButton: {
    click (event, { dispatch }) {
      dispatch(moveTeam({ id: event.target.parentNode.getAttribute("data-key") - 0 , direction: -1 }));
    }
  },
  moveTeamRightButton: {
    click (event, { dispatch }) {
      dispatch(moveTeam({ id: event.target.parentNode.getAttribute("data-key") - 0 , direction: 1 }));
    }
  }
});

export default withClickHandlers(createComponent(template, stateReducer));