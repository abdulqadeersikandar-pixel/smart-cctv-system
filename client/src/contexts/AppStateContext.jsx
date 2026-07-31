import { createContext, useMemo, useReducer } from 'react';

const initialState = {
  dashboard: {
    summary: null,
    loading: true,
    error: '',
    lastLoadedAt: null,
  },
  cameras: {
    items: [],
    online: [],
    selectedIds: [],
    focusId: '',
  },
  alerts: {
    events: [],
    lastMotionAlert: null,
    motionByCamera: {},
  },
  recordings: {
    items: [],
  },
  streams: {
    byCamera: {}, // cameraId -> { streamActive, recordingActive }
    viewMode: 'single', // single | grid
  },
  settings: {
    gridColumns: 2,
  },
};

function appReducer(state, action) {
  switch (action.type) {
    case 'DASHBOARD_LOADING':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          loading: action.payload,
        },
      };
    case 'DASHBOARD_ERROR':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          error: action.payload,
        },
      };
    case 'SET_DASHBOARD_DATA':
      return {
        ...state,
        dashboard: {
          ...state.dashboard,
          summary: action.payload.summary,
          loading: false,
          error: '',
          lastLoadedAt: new Date().toISOString(),
        },
        cameras: {
          ...state.cameras,
          items: action.payload.cameras,
        },
        alerts: {
          ...state.alerts,
          events: action.payload.events,
        },
        recordings: {
          ...state.recordings,
          items: action.payload.recordings,
        },
      };
    case 'SET_ONLINE_CAMERAS':
      return {
        ...state,
        cameras: {
          ...state.cameras,
          online: action.payload,
        },
      };
    case 'SET_LAST_MOTION_ALERT':
      return {
        ...state,
        alerts: {
          ...state.alerts,
          lastMotionAlert: action.payload.alert,
          motionByCamera: {
            ...state.alerts.motionByCamera,
            [action.payload.cameraId]: action.payload.motionActive,
          },
        },
      };
    case 'SET_RECORDINGS':
      return {
        ...state,
        recordings: {
          ...state.recordings,
          items: action.payload,
        },
      };
    case 'UPSERT_RECORDING':
      return {
        ...state,
        recordings: {
          ...state.recordings,
          items: [action.payload, ...state.recordings.items.filter((item) => item.id !== action.payload.id)],
        },
      };
    case 'SET_SELECTED_CAMERAS':
      return {
        ...state,
        cameras: {
          ...state.cameras,
          selectedIds: action.payload,
          focusId: action.payload[0] || '',
        },
      };
    case 'SET_FOCUS_CAMERA':
      return {
        ...state,
        cameras: {
          ...state.cameras,
          focusId: action.payload,
        },
      };
    case 'SET_VIEW_MODE':
      return {
        ...state,
        streams: {
          ...state.streams,
          viewMode: action.payload,
        },
      };
    case 'SET_STREAM_STATE':
      return {
        ...state,
        streams: {
          ...state.streams,
          byCamera: {
            ...state.streams.byCamera,
            [action.payload.cameraId]: {
              ...(state.streams.byCamera[action.payload.cameraId] || {}),
              ...action.payload.value,
            },
          },
        },
      };
    case 'SET_GRID_COLUMNS':
      return {
        ...state,
        settings: {
          ...state.settings,
          gridColumns: action.payload,
        },
      };
    default:
      return state;
  }
}

export const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}
