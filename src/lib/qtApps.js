import { HyperCbtMark, QtMark } from './AppMarks.jsx'
import LogoMark from './LogoMark.jsx'

// Every Quality Tools app, for the top bar's app switcher (AppSwitcher.jsx).
// Keep the list (and its order) the same in each app; add new tools here.
export const QT_APPS = [
  { id: 'qt', name: 'Quality Tools', url: 'https://quality-toolsx.web.app/', Mark: QtMark },
  { id: 'peraform', name: 'PeraForm', url: 'https://peraform-qt.web.app/', Mark: LogoMark },
  { id: 'hypercbt', name: 'HyperCBT', url: 'https://hypercbt-qt.web.app/', Mark: HyperCbtMark },
]

// This app's id in QT_APPS (highlighted, and opened in the same tab).
export const CURRENT_APP = 'peraform'
