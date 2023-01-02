import { Channels } from 'constants/Channels'
import Storage, { generateUUID } from 'constants/Storage'
import CryptoJS from 'crypto-js'
import { ClusterModel, ClusterType } from 'models/Cluster'
import { useEffect, useRef, useState } from 'react'
import { ConfigFileService, useConfigFileState } from 'renderer/services/ConfigFileService'
import { SettingsService, useSettingsState } from 'renderer/services/SettingsService'

import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import AppsIcon from '@mui/icons-material/Apps'
import DisplaySettingsIcon from '@mui/icons-material/DisplaySettings'
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck'
import ViewListIcon from '@mui/icons-material/ViewList'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Step,
  StepLabel,
  Stepper
} from '@mui/material'
import { StepIconProps } from '@mui/material/StepIcon'

import { ColorlibConnector, ColorlibStepIconRoot } from './Colorlib'
import ConfigAuthView from './ConfigAuthView'
import ConfigClusterView from './ConfigClusterView'
import ConfigConfigsView from './ConfigConfigsView'
import ConfigFlagsView from './ConfigFlagsView'
import ConfigSummaryView from './ConfigSummaryView'
import ConfigVarsView from './ConfigVarsView'

const ColorlibStepIcon = (props: StepIconProps) => {
  const { active, completed, className } = props

  const icons: { [index: string]: React.ReactElement } = {
    1: <AdminPanelSettingsIcon />,
    2: <ViewListIcon />,
    3: <DisplaySettingsIcon />,
    4: <AppsIcon />,
    5: <PlaylistAddCheckIcon />
  }

  return (
    <ColorlibStepIconRoot ownerState={{ completed, active }} className={className}>
      {icons[String(props.icon)]}
    </ColorlibStepIconRoot>
  )
}

interface Props {
  onClose: () => void
}

const CreateClusterDialog = ({ onClose }: Props) => {
  const contentStartRef = useRef(null)
  const settingsState = useSettingsState()
  const { sudoPassword } = settingsState.value

  const configFileState = useConfigFileState()
  const { loading } = configFileState.value

  const [activeStep, setActiveStep] = useState(0)
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState(() => {
    if (sudoPassword) {
      let decrypted = CryptoJS.AES.decrypt(sudoPassword, Storage.PASSWORD_KEY).toString(CryptoJS.enc.Utf8)
      decrypted = decrypted.startsWith('"') ? decrypted.substring(1) : decrypted
      decrypted = decrypted.endsWith('"') ? decrypted.substring(0, decrypted.length - 1) : decrypted

      return decrypted
    }

    return ''
  })
  const [name, setName] = useState('')
  const [type, setType] = useState<ClusterType | undefined>(undefined)
  const [defaultConfigs, setDefaultConfigs] = useState<Record<string, string>>({})
  const [defaultVars, setDefaultVars] = useState<Record<string, string>>({})
  const [tempConfigs, setTempConfigs] = useState({} as Record<string, string>)
  const [tempVars, setTempVars] = useState({} as Record<string, string>)
  const [localFlags, setLocalFlags] = useState({ [Storage.FORCE_DB_REFRESH]: 'false' } as Record<string, string>)

  const localConfigs = {} as Record<string, string>
  for (const key in defaultConfigs) {
    localConfigs[key] = key in tempConfigs ? tempConfigs[key] : defaultConfigs[key]
  }

  const localVars = {} as Record<string, string>
  for (const key in defaultVars) {
    localVars[key] = key in tempVars ? tempVars[key] : defaultVars[key]
  }

  useEffect(() => {
    loadDefaultConfigs()
  }, [])

  const loadDefaultConfigs = async () => {
    const configs = await ConfigFileService.getDefaultConfigs()
    setDefaultConfigs(configs)
  }

  const loadDefaultVariables = async (clusterType: ClusterType) => {
    setLoading(true)
    const vars = await ConfigFileService.getDefaultVariables(clusterType, localConfigs[Storage.ENGINE_PATH])
    setDefaultVars(vars)
    setLoading(false)
  }

  const handleNext = async () => {
    if (activeStep === 0) {
      setLoading(true)
      const sudoLoggedIn = await window.electronAPI.invoke(Channels.Shell.CheckSudoPassword, password)
      setLoading(false)
      if (sudoLoggedIn) {
        SettingsService.setSudoPassword(password)
      } else {
        setError('Invalid password')
        return
      }
    } else {
      if (!name || name.length < 3) {
        setError('Please select a cluster name of minimum 3 words')
        return
      }

      if (!type) {
        setError('Please select a valid cluster type')
        return
      }

      if (activeStep === 2) {
        loadDefaultVariables(type)
      } else if (activeStep === 4) {
        const createCluster: ClusterModel = {
          id: generateUUID(),
          name,
          type,
          configs: { ...localConfigs },
          variables: { ...localVars }
        }

        const inserted = await ConfigFileService.insertOrUpdateConfig(createCluster)
        if (!inserted) {
          return
        }

        ConfigFileService.setSelectedClusterId(createCluster.id)
        // DeploymentService.processConfigurations(password, localConfigs, localVars, localFlags)
        onClose()

        return
      }
    }

    setActiveStep((prevActiveStep) => prevActiveStep + 1)
    setError('')
  }

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1)
    setError('')
  }

  const onChangeFlag = async (key: string, value: string) => {
    const newFlags = { ...localFlags }
    newFlags[key] = value
    setLocalFlags(newFlags)
    setError('')
  }

  const onChangeConfig = async (key: string, value: string) => {
    const newConfigs = { ...tempConfigs }
    newConfigs[key] = value
    setTempConfigs(newConfigs)
    setError('')
  }

  const onChangeVar = async (key: string, value: string) => {
    const newVars = { ...tempVars }
    newVars[key] = value
    setTempVars(newVars)
    setError('')
  }

  const onChangePassword = (password: string) => {
    setPassword(password)
    setError('')
  }

  const steps = [
    {
      label: 'Authenticate',
      title: 'Provide sudo admin password to authenticate',
      content: (
        <ConfigAuthView
          password={password}
          sx={{ marginLeft: 2, marginRight: 2 }}
          onChange={onChangePassword}
          onEnter={handleNext}
        />
      )
    },
    {
      label: 'Cluster',
      title: 'Provide cluster information',
      content: (
        <ConfigClusterView
          name={name}
          type={type}
          sx={{ marginLeft: 2, marginRight: 2 }}
          onNameChange={(name) => {
            setName(name)
            setError('')
          }}
          onTypeChange={(type) => {
            setType(type)
            setError('')
          }}
        />
      )
    },
    {
      label: 'Configs',
      title: 'Provide configuration details',
      content: (
        <Box sx={{ marginLeft: 2, marginRight: 2 }}>
          <ConfigConfigsView localConfigs={localConfigs} onChange={onChangeConfig} />
          <ConfigFlagsView localFlags={localFlags} onChange={onChangeFlag} />
        </Box>
      )
    },
    {
      label: 'Variables',
      title: 'Provide configuration variables (Optional)',
      content: <ConfigVarsView localVars={localVars} sx={{ marginLeft: 2, marginRight: 2 }} onChange={onChangeVar} />
    },
    {
      label: 'Summary',
      title: 'Review configurations before finalizing',
      content: (
        <ConfigSummaryView
          name={name}
          type={type}
          localConfigs={localConfigs}
          localVars={localVars}
          localFlags={localFlags}
          sx={{ marginLeft: 2, marginRight: 2 }}
        />
      )
    }
  ]

  useEffect(() => (contentStartRef.current as any)?.scrollTo(0, 0), [activeStep])

  return (
    <Dialog open fullWidth maxWidth="sm">
      {(isLoading || loading) && <LinearProgress />}
      <DialogTitle>
        <Stepper alternativeLabel activeStep={activeStep} connector={<ColorlibConnector />}>
          {steps.map((step) => (
            <Step key={step.label}>
              <StepLabel StepIconComponent={ColorlibStepIcon}>{step.label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </DialogTitle>

      <DialogContentText sx={{ margin: 3, marginBottom: 0 }}>{steps[activeStep].title}</DialogContentText>

      {error && (
        <DialogContentText color={'red'} sx={{ marginLeft: 5, marginRight: 5 }}>
          Error: {error}
        </DialogContentText>
      )}

      <DialogContent ref={contentStartRef} sx={{ height: '27vh', marginBottom: 3 }}>
        {steps[activeStep].content}
      </DialogContent>
      <DialogActions>
        <Box sx={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
          <Button onClick={() => onClose()}>Cancel</Button>

          <Box sx={{ flex: '1 1 auto' }} />

          <Button color="inherit" disabled={activeStep === 0} onClick={handleBack} sx={{ mr: 1 }}>
            Back
          </Button>
          <Button onClick={handleNext}>{activeStep === steps.length - 1 ? 'Create' : 'Next'}</Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}

export default CreateClusterDialog
