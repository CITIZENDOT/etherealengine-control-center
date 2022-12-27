import { createState, useState } from '@speigg/hookstate'
import { Channels } from 'constants/Channels'
import Storage from 'constants/Storage'
import CryptoJS from 'crypto-js'
import { SnackbarProvider } from 'notistack'

import { store, useDispatch } from '../store'

type FetchableItem<T> = {
  loading: boolean
  data: T
  error: string
}

//State
const state = createState({
  appVersion: '',
  sudoPassword: '',
  notistack: {} as SnackbarProvider,
  ipfs: {
    loading: false,
    url: '',
    error: ''
  },
  adminPanel: {
    loading: false,
    adminAccess: false,
    error: ''
  },
  k8dashboard: {
    loading: false,
    url: '',
    error: ''
  }
})

store.receptors.push((action: SettingsActionType): void => {
  state.batch((s) => {
    switch (action.type) {
      case 'SET_APP_VERSION':
        return s.merge({
          appVersion: action.payload
        })
      case 'SET_SUDO_PASSWORD':
        return s.merge({
          sudoPassword: action.payload
        })
      case 'SET_NOTISTACK':
        return s.merge({
          notistack: action.payload
        })
      case 'SET_K8_DASHBOARD':
        return s.merge({
          k8dashboard: {
            loading: action.payload.loading,
            url: action.payload.data,
            error: action.payload.error
          }
        })
      case 'SET_IPFS_DASHBOARD':
        return s.merge({
          ipfs: {
            loading: action.payload.loading,
            url: action.payload.data,
            error: action.payload.error
          }
        })
      case 'SET_ADMIN_PANEL':
        return s.merge({
          adminPanel: {
            loading: action.payload.loading,
            adminAccess: action.payload.data,
            error: action.payload.error
          }
        })
    }
  }, action.type)
})

export const accessSettingsState = () => state

export const useSettingsState = () => useState(state) as any as typeof state

//Service
export const SettingsService = {
  init: async () => {
    const dispatch = useDispatch()
    const version = await window.electronAPI.invoke(Channels.Utilities.GetVersion)
    dispatch(SettingsAction.setAppVersion(version))
  },
  setNotiStack: async (callback: SnackbarProvider) => {
    const dispatch = useDispatch()
    dispatch(SettingsAction.setNotiStack(callback))
  },
  setSudoPassword: (password: string) => {
    const dispatch = useDispatch()
    const encryptedPassword = CryptoJS.AES.encrypt(JSON.stringify(password), Storage.PASSWORD_KEY).toString()
    dispatch(SettingsAction.setSudoPassword(encryptedPassword))
  },
  fetchK8Dashboard: async () => {
    const dispatch = useDispatch()
    try {
      dispatch(
        SettingsAction.setK8Dashboard({
          loading: true,
          data: '',
          error: ''
        })
      )
      window.electronAPI.invoke(Channels.Shell.ConfigureMinikubeDashboard)
    } catch (error) {
      console.error(error)
    }
  },
  clearK8Dashboard: async () => {
    const dispatch = useDispatch()
    try {
      dispatch(
        SettingsAction.setK8Dashboard({
          loading: false,
          data: '',
          error: ''
        })
      )
    } catch (error) {
      console.error(error)
    }
  },
  fetchIpfsDashboard: async () => {
    const dispatch = useDispatch()
    try {
      dispatch(
        SettingsAction.setIpfsDashboard({
          loading: true,
          data: '',
          error: ''
        })
      )
      window.electronAPI.invoke(Channels.Shell.ConfigureIPFSDashboard)
    } catch (error) {
      console.error(error)
    }
  },
  clearIpfsDashboard: async () => {
    const dispatch = useDispatch()
    try {
      dispatch(
        SettingsAction.setIpfsDashboard({
          loading: false,
          data: '',
          error: ''
        })
      )
    } catch (error) {
      console.error(error)
    }
  },
  fetchAdminPanelAccess: async () => {
    const dispatch = useDispatch()
    try {
      dispatch(
        SettingsAction.setAdminPanel({
          loading: true,
          data: false,
          error: ''
        })
      )
      window.electronAPI.invoke(Channels.Engine.EnsureAdminAccess)
    } catch (error) {
      console.error(error)
    }
  },
  clearAdminPanelAccess: async () => {
    const dispatch = useDispatch()
    try {
      dispatch(
        SettingsAction.setAdminPanel({
          loading: false,
          data: false,
          error: ''
        })
      )
    } catch (error) {
      console.error(error)
    }
  },
  listen: async () => {
    const dispatch = useDispatch()
    try {
      window.electronAPI.on(Channels.Shell.ConfigureMinikubeDashboardResponse, (data: string) => {
        dispatch(
          SettingsAction.setK8Dashboard({
            loading: false,
            data,
            error: ''
          })
        )
      })
      window.electronAPI.on(Channels.Shell.ConfigureMinikubeDashboardError, (error: string) => {
        dispatch(
          SettingsAction.setK8Dashboard({
            loading: false,
            data: '',
            error
          })
        )
      })
      window.electronAPI.on(Channels.Shell.ConfigureIPFSDashboardResponse, (data: string) => {
        dispatch(
          SettingsAction.setIpfsDashboard({
            loading: false,
            data,
            error: ''
          })
        )
      })
      window.electronAPI.on(Channels.Shell.ConfigureIPFSDashboardError, (error: string) => {
        dispatch(
          SettingsAction.setIpfsDashboard({
            loading: false,
            data: '',
            error
          })
        )
      })
      window.electronAPI.on(Channels.Engine.EnsureAdminAccessResponse, () => {
        dispatch(
          SettingsAction.setAdminPanel({
            loading: false,
            data: true,
            error: ''
          })
        )
      })
      window.electronAPI.on(Channels.Engine.EnsureAdminAccessError, (error: string) => {
        dispatch(
          SettingsAction.setAdminPanel({
            loading: false,
            data: false,
            error
          })
        )
      })
    } catch (error) {
      console.error(error)
    }
  }
}

//Action
export const SettingsAction = {
  setAppVersion: (payload: string) => {
    return {
      type: 'SET_APP_VERSION' as const,
      payload
    }
  },
  setSudoPassword: (payload: string) => {
    return {
      type: 'SET_SUDO_PASSWORD' as const,
      payload
    }
  },
  setNotiStack: (payload: SnackbarProvider) => {
    return {
      type: 'SET_NOTISTACK' as const,
      payload
    }
  },
  setK8Dashboard: (payload: FetchableItem<string>) => {
    return {
      type: 'SET_K8_DASHBOARD' as const,
      payload
    }
  },
  setIpfsDashboard: (payload: FetchableItem<string>) => {
    return {
      type: 'SET_IPFS_DASHBOARD' as const,
      payload
    }
  },
  setAdminPanel: (payload: FetchableItem<boolean>) => {
    return {
      type: 'SET_ADMIN_PANEL' as const,
      payload
    }
  }
}

export type SettingsActionType = ReturnType<typeof SettingsAction[keyof typeof SettingsAction]>
