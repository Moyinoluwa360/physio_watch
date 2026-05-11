import { createContext, useContext, useEffect, useReducer, useState } from 'react'
import { Navigate, NavLink, Outlet, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import styled, { createGlobalStyle, keyframes } from 'styled-components'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeAlert,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Eye,
  FileHeart,
  Filter,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { runAssessmentFromVitals } from './lib/assessmentApi'
import { loadMockState, saveMockState, clearMockSession, createMockSession, getSeedDoctor } from './lib/mockStore'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  VITALS,
  buildAgeGroups,
  buildAssessmentTrend,
  buildChartSeries,
  buildRiskBatches,
  buildStatusBreakdown,
  formatWatDateKey,
  formatWatDateTime,
  getAge,
  getRiskBand,
  getVitalStatus,
  initialsFromName,
} from './lib/physio'

const AuthContext = createContext(null)
const RecordsContext = createContext(null)
const ToastContext = createContext(null)

const initialRecordsState = {
  patients: [],
  assessments: [],
  loading: false,
  syncing: false,
}

function recordsReducer(state, action) {
  switch (action.type) {
    case 'hydrate_start':
      return { ...state, loading: true }
    case 'hydrate_success':
      return {
        ...state,
        patients: action.patients,
        assessments: action.assessments,
        loading: false,
      }
    case 'hydrate_empty':
      return { ...initialRecordsState }
    case 'sync_start':
      return { ...state, syncing: true }
    case 'sync_end':
      return { ...state, syncing: false }
    case 'replace_records':
      return {
        ...state,
        patients: action.patients,
        assessments: action.assessments,
      }
    default:
      return state
  }
}

const pageFade = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
`

const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.72; }
  50% { transform: scale(1.05); opacity: 1; }
`

const GlobalStyle = createGlobalStyle`
  :root {
    color-scheme: dark;
    --bg: #000000;
    --panel: rgba(10, 22, 40, 0.9);
    --panel-soft: rgba(8, 14, 24, 0.76);
    --panel-alt: rgba(255, 255, 255, 0.03);
    --border: rgba(255, 255, 255, 0.08);
    --border-strong: rgba(255, 255, 255, 0.14);
    --text: rgba(255, 255, 255, 0.92);
    --muted: rgba(255, 255, 255, 0.62);
    --muted-2: rgba(255, 255, 255, 0.42);
    --accent: #7cffb2;
    --accent-soft: rgba(124, 255, 178, 0.12);
    --accent-border: rgba(124, 255, 178, 0.28);
    --success: #10b981;
    --danger: #ef4444;
    --warning: #f59e0b;
    --shadow: 0 28px 80px rgba(0, 0, 0, 0.4);
    --radius-xl: 28px;
    --radius-lg: 20px;
    --radius-md: 14px;
  }

  * {
    box-sizing: border-box;
  }

  html {
    min-height: 100%;
    background:
      radial-gradient(circle at top left, rgba(124, 255, 178, 0.08), transparent 32%),
      radial-gradient(circle at top right, rgba(148, 163, 184, 0.08), transparent 28%),
      var(--bg);
  }

  body {
    margin: 0;
    min-height: 100vh;
    background:
      radial-gradient(circle at 15% 10%, rgba(124, 255, 178, 0.08), transparent 22%),
      radial-gradient(circle at 85% 20%, rgba(255, 255, 255, 0.04), transparent 18%),
      linear-gradient(180deg, #030712 0%, #000000 55%, #040810 100%);
    color: var(--text);
    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .spin {
    animation: spin 900ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
  }

  ::selection {
    background: rgba(124, 255, 178, 0.26);
  }

  #root {
    min-height: 100vh;
  }
`

const AppFrame = styled.div`
  min-height: 100vh;
`

const ShellLayout = styled.div`
  display: grid;
  grid-template-columns: ${({ $collapsed }) => ($collapsed ? '92px' : '280px')} minmax(0, 1fr);
  min-height: 100vh;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`

const Sidebar = styled.aside`
  position: sticky;
  top: 0;
  height: 100vh;
  padding: 20px 16px;
  border-right: 1px solid var(--border);
  background: rgba(3, 7, 18, 0.82);
  backdrop-filter: blur(24px);
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: hidden;

  @media (max-width: 1024px) {
    position: fixed;
    inset: 0 auto 0 0;
    width: 280px;
    transform: translateX(${({ $open }) => ($open ? '0' : '-100%')});
    transition: transform 220ms ease;
    z-index: 30;
    box-shadow: var(--shadow);
  }
`

const SidebarBackdrop = styled.button`
  display: none;
  border: 0;
  padding: 0;
  background: rgba(0, 0, 0, 0.45);
  position: fixed;
  inset: 0;
  z-index: 25;

  @media (max-width: 1024px) {
    display: ${({ $open }) => ($open ? 'block' : 'none')};
  }
`

const BrandBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 6px 8px 12px;
`

const BrandMark = styled.div`
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  color: #04111b;
  background: linear-gradient(135deg, #7cffb2 0%, #e8fff3 100%);
  box-shadow: 0 0 0 1px rgba(124, 255, 178, 0.22), 0 12px 28px rgba(124, 255, 178, 0.2);
`

const BrandTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  strong {
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: white;
  }

  span {
    color: var(--muted);
    font-size: 12px;
  }
`

const SidebarNav = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const NavItem = styled(NavLink)`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  color: var(--muted);
  border: 1px solid transparent;
  transition: 180ms ease;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
    color: white;
  }

  &.active {
    color: white;
    background: var(--accent-soft);
    border-color: var(--accent-border);
    box-shadow: 0 0 0 1px rgba(124, 255, 178, 0.12) inset;
  }
`

const SidebarFooter = styled.div`
  margin-top: auto;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  gap: 12px;
`

const MainArea = styled.main`
  min-width: 0;
`

const TopBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border);
  background: rgba(3, 7, 18, 0.7);
  backdrop-filter: blur(22px);

  @media (max-width: 768px) {
    padding: 16px;
    flex-wrap: wrap;
  }
`

const TopBarCluster = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const CollapseButton = styled.button`
  width: 44px;
  height: 44px;
  border-radius: 14px;
  border: 1px solid var(--border);
  color: white;
  background: rgba(255, 255, 255, 0.03);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: 160ms ease;

  &:hover {
    border-color: var(--accent-border);
    background: rgba(124, 255, 178, 0.08);
  }
`

const HeaderTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    color: white;
    font-size: 18px;
    letter-spacing: -0.02em;
  }

  span {
    color: var(--muted);
    font-size: 12px;
  }
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;

  @media (max-width: 768px) {
    width: 100%;
    margin-left: 0;
    justify-content: space-between;
  }
`

const SearchField = styled.div`
  min-width: 280px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);

  input {
    flex: 1;
    border: 0;
    background: transparent;
    outline: none;
    color: white;
  }

  input::placeholder {
    color: var(--muted-2);
  }

  @media (max-width: 768px) {
    min-width: 0;
    width: 100%;
  }
`

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px solid ${({ $variant }) => ($variant === 'ghost' ? 'var(--border)' : 'transparent')};
  background: ${({ $variant }) => ($variant === 'ghost' ? 'rgba(255, 255, 255, 0.03)' : 'linear-gradient(135deg, #7cffb2 0%, #d9ffee 100%)')};
  color: ${({ $variant }) => ($variant === 'ghost' ? 'white' : '#031118')};
  border-radius: 14px;
  padding: 12px 16px;
  cursor: pointer;
  font-weight: 700;
  box-shadow: ${({ $variant }) => ($variant === 'ghost' ? 'none' : '0 16px 36px rgba(124, 255, 178, 0.18)')};
  transition: 180ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: ${({ $variant }) => ($variant === 'ghost' ? 'none' : '0 18px 42px rgba(124, 255, 178, 0.24)')};
    border-color: rgba(124, 255, 178, 0.24);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`

const PageShell = styled.section`
  padding: 24px;
  display: grid;
  gap: 24px;
  animation: ${pageFade} 260ms ease;

  @media (max-width: 768px) {
    padding: 16px;
  }
`

const SectionCard = styled.section`
  border: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(12, 18, 29, 0.92), rgba(6, 10, 18, 0.92));
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow);
  padding: 22px;
  overflow: hidden;
`

const SectionHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;

  h2,
  h3,
  h4 {
    margin: 0;
    color: white;
    letter-spacing: -0.03em;
  }

  p {
    margin-top: 4px;
    color: var(--muted);
  }
`

const Grid = styled.div`
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(${({ $cols }) => $cols || 12}, minmax(0, 1fr));
`

const MetricCard = styled.article`
  grid-column: span ${({ $span }) => $span || 3};
  padding: 18px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: ${({ $accent }) => ($accent ? 'linear-gradient(180deg, rgba(124, 255, 178, 0.12), rgba(255, 255, 255, 0.03))' : 'rgba(255, 255, 255, 0.03)')};
  min-height: 124px;
  display: grid;
  gap: 14px;

  @media (max-width: 1024px) {
    grid-column: span 6;
  }

  @media (max-width: 640px) {
    grid-column: span 12;
  }
`

const MetricLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
`

const MetricValue = styled.div`
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: white;
`

const SubtleText = styled.p`
  color: var(--muted);
  margin: 0;
`

const StatusChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid;
  color: ${({ $tone }) => ($tone === 'success' ? '#8ff0bf' : $tone === 'danger' ? '#ff9b9b' : 'rgba(255,255,255,0.68)')};
  background: ${({ $tone }) => ($tone === 'success' ? 'rgba(16,185,129,0.12)' : $tone === 'danger' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)')};
  border-color: ${({ $tone }) => ($tone === 'success' ? 'rgba(16,185,129,0.26)' : $tone === 'danger' ? 'rgba(239,68,68,0.26)' : 'var(--border)')};
`

const TableWrap = styled.div`
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;

  thead {
    background: rgba(255, 255, 255, 0.03);
  }

  th,
  td {
    padding: 14px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  th {
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  tbody tr:hover {
    background: rgba(255, 255, 255, 0.02);
  }
`

const InputGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const Field = styled.label`
  display: grid;
  gap: 8px;
  color: white;
  font-weight: 600;

  span {
    font-size: 13px;
    color: var(--muted);
    font-weight: 500;
  }
`

const Input = styled.input`
  width: 100%;
  padding: 14px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
  color: white;
  outline: none;
  transition: 180ms ease;

  &:focus {
    border-color: rgba(124, 255, 178, 0.34);
    box-shadow: 0 0 0 4px rgba(124, 255, 178, 0.08);
  }

  &::placeholder {
    color: var(--muted-2);
  }
`

const Select = styled.select`
  width: 100%;
  padding: 14px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
  color: white;
  outline: none;
  transition: 180ms ease;

  &:focus {
    border-color: rgba(124, 255, 178, 0.34);
    box-shadow: 0 0 0 4px rgba(124, 255, 178, 0.08);
  }

  option {
    background: #030712;
  }
`

const Textarea = styled.textarea`
  width: 100%;
  min-height: 110px;
  resize: vertical;
  padding: 14px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
  color: white;
  outline: none;
  transition: 180ms ease;

  &:focus {
    border-color: rgba(124, 255, 178, 0.34);
    box-shadow: 0 0 0 4px rgba(124, 255, 178, 0.08);
  }
`

const RangeHint = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--muted);
  font-size: 12px;
`

const WarningLine = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fbbf24;
  font-size: 12px;
`

const EmptyState = styled.div`
  padding: 28px;
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-strong);
  background: rgba(255, 255, 255, 0.02);
  display: grid;
  gap: 10px;
  text-align: center;
  color: var(--muted);
`

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(10px);
  display: grid;
  place-items: center;
  padding: 20px;
`

const OverlayCard = styled.div`
  width: min(420px, 100%);
  padding: 24px;
  border-radius: 24px;
  border: 1px solid var(--border-strong);
  background: rgba(5, 9, 16, 0.95);
  box-shadow: var(--shadow);
  display: grid;
  justify-items: center;
  gap: 16px;
  text-align: center;
`

const Spinner = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 999px;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: var(--accent);
  animation: ${pulse} 1.1s ease-in-out infinite;
`

const ToastHost = styled.div`
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 90;
  display: grid;
  gap: 10px;
  width: min(360px, calc(100vw - 36px));
`

const ToastItem = styled.div`
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid ${({ $kind }) => ($kind === 'error' ? 'rgba(239,68,68,0.24)' : 'rgba(124,255,178,0.18)')};
  background: ${({ $kind }) => ($kind === 'error' ? 'rgba(80, 10, 16, 0.95)' : 'rgba(8, 18, 12, 0.95)')};
  box-shadow: var(--shadow);
  color: white;
  display: grid;
  gap: 4px;

  strong {
    font-size: 14px;
  }

  span {
    color: var(--muted);
    font-size: 12px;
  }
`

const AuthLayout = styled.div`
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  padding: 20px;
  gap: 20px;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`

const AuthHero = styled.div`
  border: 1px solid var(--border);
  border-radius: 28px;
  background:
    radial-gradient(circle at top right, rgba(124, 255, 178, 0.14), transparent 30%),
    linear-gradient(180deg, rgba(11, 18, 32, 0.95), rgba(5, 8, 14, 0.95));
  padding: 28px;
  display: grid;
  align-content: space-between;
  gap: 28px;
  box-shadow: var(--shadow);
`

const AuthFormCard = styled.div`
  border: 1px solid var(--border);
  border-radius: 28px;
  background: rgba(7, 11, 19, 0.92);
  padding: 28px;
  display: grid;
  align-content: center;
  gap: 22px;
  box-shadow: var(--shadow);
`

const AuthBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 8px 12px;
  border: 1px solid rgba(124, 255, 178, 0.2);
  border-radius: 999px;
  background: rgba(124, 255, 178, 0.08);
  color: #cffce0;
  font-weight: 700;
  font-size: 12px;
`

const HeroMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`

const HeroMetric = styled.div`
  padding: 16px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);

  strong {
    display: block;
    color: white;
    font-size: 24px;
    letter-spacing: -0.03em;
  }

  span {
    color: var(--muted);
    font-size: 12px;
  }
`

const RiskBanner = styled.div`
  border-radius: 24px;
  padding: 18px 20px;
  border: 1px solid ${({ $tone }) => ($tone === 'danger' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)')};
  background: ${({ $tone }) => ($tone === 'danger' ? 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(11, 17, 28, 0.96))' : 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(11, 17, 28, 0.96))')};
  display: grid;
  gap: 8px;

  h3 {
    margin: 0;
    color: white;
    font-size: 28px;
    letter-spacing: -0.04em;
  }

  p {
    margin: 0;
    color: rgba(255, 255, 255, 0.72);
  }
`

const ProgressTrack = styled.div`
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
`

const ProgressFill = styled.div`
  height: 100%;
  width: ${({ $value }) => `${Math.max(0, Math.min(100, $value))}%`};
  border-radius: inherit;
  background: ${({ $kind }) => ($kind === 'danger' ? 'linear-gradient(90deg, #ef4444, #ff8a8a)' : 'linear-gradient(90deg, #10b981, #7cffb2)')};
  transition: width 260ms ease;
`

const TogglePill = styled.button`
  border: 1px solid ${({ $active }) => ($active ? 'rgba(124,255,178,0.3)' : 'var(--border)')};
  background: ${({ $active }) => ($active ? 'rgba(124,255,178,0.12)' : 'rgba(255,255,255,0.03)')};
  color: white;
  border-radius: 999px;
  padding: 10px 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: 180ms ease;

  &:hover {
    border-color: rgba(124, 255, 178, 0.3);
    transform: translateY(-1px);
  }
`

const StepDivider = styled.div`
  height: 1px;
  background: var(--border);
  margin: 14px 0;
`

function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let unsubscribe = null

    async function initialize() {
      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession()
        if (!active) return

        const nextSession = data.session ?? null
        setSession(nextSession)

        if (nextSession?.user) {
          await ensureProfile(nextSession.user)
        }

        const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextValue) => {
          if (!active) return
          setSession(nextValue)
          if (nextValue?.user) {
            await ensureProfile(nextValue.user)
          }
        })

        unsubscribe = () => subscription.subscription.unsubscribe()

        setLoading(false)
        return
      }

      const mockState = loadMockState()
      setSession(mockState.session ?? null)
      setProfile(mockState.session?.user ?? mockState.profiles?.[0] ?? getSeedDoctor())
      setLoading(false)
    }

    async function ensureProfile(user) {
      const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Doctor'
      const nextProfile = {
        id: user.id,
        email: user.email,
        full_name: displayName,
      }

      try {
        await supabase.from('profiles').upsert(nextProfile, { onConflict: 'id' })
      } catch {
        // Profile creation is best-effort so the app still works when RLS is stricter.
      }

      setProfile(nextProfile)
    }

    initialize()

    return () => {
      active = false
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const login = async (email, password) => {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setSession(data.session)
      if (data.user) {
        const nextProfile = {
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'Doctor',
        }

        try {
          await supabase.from('profiles').upsert(nextProfile, { onConflict: 'id' })
        } catch {
          // ignore profile upsert failures
        }

        setProfile(nextProfile)
      }

      return
    }

    const mockSession = createMockSession(email)
    const nextProfile = {
      id: mockSession.user.id,
      email,
      full_name: 'Dr. Ada Okafor',
    }
    const currentState = loadMockState()
    saveMockState({ ...currentState, session: mockSession, profiles: [nextProfile], sessionUser: nextProfile })
    setSession(mockSession)
    setProfile(nextProfile)
  }

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut()
    } else {
      clearMockSession()
    }

    setSession(null)
    setProfile(null)
  }

  return <AuthContext.Provider value={{ session, profile, loading, login, logout }}>{children}</AuthContext.Provider>
}

function RecordsProvider({ children }) {
  const { session } = useAuth()
  const [, setPatients] = useState([])
  const [, setAssessments] = useState([])
  const [, setLoading] = useState(false)
  const [, setSyncing] = useState(false)
  const [state, dispatch] = useReducer(recordsReducer, initialRecordsState)

  useEffect(() => {
    let active = true

    async function loadRecords() {
      if (!session?.user) {
        setPatients([])
        setAssessments([])
        setLoading(false)
        dispatch({ type: 'hydrate_empty' })
        return
      }

      setLoading(true)
      dispatch({ type: 'hydrate_start' })

      if (isSupabaseConfigured && supabase) {
        const [patientsResult, assessmentsResult] = await Promise.all([
          supabase.from('patients').select('*').eq('doctor_id', session.user.id).order('created_at', { ascending: false }),
          supabase.from('assessments').select('*').eq('doctor_id', session.user.id).order('assessed_at', { ascending: false }),
        ])

        if (!active) return

        setPatients(patientsResult.data ?? [])
        setAssessments(assessmentsResult.data ?? [])
        setLoading(false)
        dispatch({
          type: 'hydrate_success',
          patients: patientsResult.data ?? [],
          assessments: assessmentsResult.data ?? [],
        })
        return
      }

      const stored = loadMockState()
      if (!active) return

      setPatients((stored.patients ?? []).filter((patient) => patient.doctor_id === session.user.id))
      setAssessments((stored.assessments ?? []).filter((assessment) => assessment.doctor_id === session.user.id))
      setLoading(false)
      dispatch({
        type: 'hydrate_success',
        patients: (stored.patients ?? []).filter((patient) => patient.doctor_id === session.user.id),
        assessments: (stored.assessments ?? []).filter((assessment) => assessment.doctor_id === session.user.id),
      })
    }

    loadRecords()

    return () => {
      active = false
    }
  }, [session])

  const persistLocalState = (nextPatients, nextAssessments) => {
    const current = loadMockState()
    saveMockState({
      ...current,
      patients: nextPatients,
      assessments: nextAssessments,
      session: current.session,
      profiles: current.profiles,
    })
  }

  const savePatientAndAssessment = async (patientInput, vitals) => {
    if (!session?.user) throw new Error('No active doctor session found.')

    dispatch({ type: 'sync_start' })
    try {
      const { matrix, series, assessment, isFallback } = await runAssessmentFromVitals(vitals)
      const now = new Date().toISOString()
      const age = getAge(patientInput.date_of_birth)

      const patientPayload = {
        doctor_id: session.user.id,
        full_name: patientInput.full_name,
        date_of_birth: patientInput.date_of_birth,
        age,
        gender: patientInput.gender,
        blood_type: patientInput.blood_type,
        height_cm: patientInput.height_cm ? Number(patientInput.height_cm) : null,
        weight_kg: patientInput.weight_kg ? Number(patientInput.weight_kg) : null,
        medical_history: patientInput.medical_history,
        known_allergies: patientInput.known_allergies,
        emergency_contact_name: patientInput.emergency_contact_name,
        emergency_contact_phone: patientInput.emergency_contact_phone,
        admission_date: patientInput.admission_date,
        ward_room: patientInput.ward_room,
        status: assessment.prediction,
        created_at: now,
      }

      let patientRecord = null

      if (isSupabaseConfigured && supabase) {
        const { data: insertedPatient, error: patientError } = await supabase
          .from('patients')
          .insert(patientPayload)
          .select('*')
          .single()

        if (patientError) throw patientError
        patientRecord = insertedPatient

        const assessmentPayload = {
          patient_id: insertedPatient.id,
          doctor_id: session.user.id,
          heart_rate: vitals.heart_rate,
          systolic_bp: vitals.systolic_bp,
          diastolic_bp: vitals.diastolic_bp,
          respiratory_rate: vitals.respiratory_rate,
          spo2: vitals.spo2,
          sequence_data: { matrix, series },
          prediction: assessment.prediction,
          confidence: assessment.confidence,
          probability_abnormal: assessment.probability_abnormal,
          probability_normal: assessment.probability_normal,
          assessed_at: now,
        }

        const { data: insertedAssessment, error: assessmentError } = await supabase
          .from('assessments')
          .insert(assessmentPayload)
          .select('*')
          .single()

        if (assessmentError) throw assessmentError

        await supabase.from('patients').update({ status: assessment.prediction }).eq('id', insertedPatient.id)

        dispatch({
          type: 'replace_records',
          patients: [{ ...insertedPatient, status: assessment.prediction }, ...state.patients],
          assessments: [insertedAssessment, ...state.assessments],
        })

        return { patient: { ...insertedPatient, status: assessment.prediction }, assessment: insertedAssessment, isFallback }
      }

      const localState = loadMockState()
      patientRecord = {
        ...patientPayload,
        id: crypto.randomUUID(),
        created_at: now,
      }

      const assessmentRecord = {
        id: crypto.randomUUID(),
        patient_id: patientRecord.id,
        doctor_id: session.user.id,
        heart_rate: vitals.heart_rate,
        systolic_bp: vitals.systolic_bp,
        diastolic_bp: vitals.diastolic_bp,
        respiratory_rate: vitals.respiratory_rate,
        spo2: vitals.spo2,
        sequence_data: { matrix, series },
        prediction: assessment.prediction,
        confidence: assessment.confidence,
        probability_abnormal: assessment.probability_abnormal,
        probability_normal: assessment.probability_normal,
        assessed_at: now,
      }

      const nextPatients = [patientRecord, ...(localState.patients ?? []).filter((patient) => patient.doctor_id === session.user.id)]
      const nextAssessments = [assessmentRecord, ...(localState.assessments ?? []).filter((item) => item.doctor_id === session.user.id)]

      persistLocalState(nextPatients, nextAssessments)
      dispatch({ type: 'replace_records', patients: nextPatients, assessments: nextAssessments })

      return { patient: patientRecord, assessment: assessmentRecord, isFallback }
    } finally {
      dispatch({ type: 'sync_end' })
    }
  }

  const saveAssessmentForPatient = async (patientId, vitals) => {
    if (!session?.user) throw new Error('No active doctor session found.')

    const patient = state.patients.find((item) => item.id === patientId)
    if (!patient) throw new Error('Patient not found.')

    setSyncing(true)
    try {
      const { matrix, series, assessment, isFallback } = await runAssessmentFromVitals(vitals)
      const now = new Date().toISOString()

      if (isSupabaseConfigured && supabase) {
        const assessmentPayload = {
          patient_id: patient.id,
          doctor_id: session.user.id,
          heart_rate: vitals.heart_rate,
          systolic_bp: vitals.systolic_bp,
          diastolic_bp: vitals.diastolic_bp,
          respiratory_rate: vitals.respiratory_rate,
          spo2: vitals.spo2,
          sequence_data: { matrix, series },
          prediction: assessment.prediction,
          confidence: assessment.confidence,
          probability_abnormal: assessment.probability_abnormal,
          probability_normal: assessment.probability_normal,
          assessed_at: now,
        }
            dispatch({ type: 'sync_start' })
        const { data: insertedAssessment, error } = await supabase.from('assessments').insert(assessmentPayload).select('*').single()
        if (error) throw error

        await supabase.from('patients').update({ status: assessment.prediction }).eq('id', patient.id)

        const nextPatients = state.patients.map((item) => (item.id === patient.id ? { ...item, status: assessment.prediction } : item))
        const nextAssessments = [insertedAssessment, ...state.assessments]
        dispatch({ type: 'replace_records', patients: nextPatients, assessments: nextAssessments })

        return { patient: { ...patient, status: assessment.prediction }, assessment: insertedAssessment, isFallback }
      }

      const assessmentRecord = {
        id: crypto.randomUUID(),
        patient_id: patient.id,
        doctor_id: session.user.id,
        heart_rate: vitals.heart_rate,
        systolic_bp: vitals.systolic_bp,
        diastolic_bp: vitals.diastolic_bp,
        respiratory_rate: vitals.respiratory_rate,
        spo2: vitals.spo2,
        sequence_data: { matrix, series },
        prediction: assessment.prediction,
        confidence: assessment.confidence,
        probability_abnormal: assessment.probability_abnormal,
        probability_normal: assessment.probability_normal,
        assessed_at: now,
      }

      const nextPatients = state.patients.map((item) => (item.id === patient.id ? { ...item, status: assessment.prediction } : item))
      const nextAssessments = [assessmentRecord, ...state.assessments]

      persistLocalState(nextPatients, nextAssessments)
      dispatch({ type: 'replace_records', patients: nextPatients, assessments: nextAssessments })

      return { patient: { ...patient, status: assessment.prediction }, assessment: assessmentRecord, isFallback }
    } finally {
      dispatch({ type: 'sync_end' })
    }
  }

  const deletePatient = async (patientId) => {
    if (!session?.user) throw new Error('No active doctor session found.')

    dispatch({ type: 'sync_start' })
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('assessments').delete().eq('patient_id', patientId)
        await supabase.from('patients').delete().eq('id', patientId)
      } else {
        const nextPatients = state.patients.filter((patient) => patient.id !== patientId)
        const nextAssessments = state.assessments.filter((assessment) => assessment.patient_id !== patientId)
        persistLocalState(nextPatients, nextAssessments)
        dispatch({ type: 'replace_records', patients: nextPatients, assessments: nextAssessments })
      }

      dispatch({
        type: 'replace_records',
        patients: state.patients.filter((patient) => patient.id !== patientId),
        assessments: state.assessments.filter((assessment) => assessment.patient_id !== patientId),
      })
    } finally {
      dispatch({ type: 'sync_end' })
    }
  }

  const value = {
    patients: state.patients,
    assessments: state.assessments,
    loading: state.loading,
    syncing: state.syncing,
    refresh: async () => {
      if (session?.user) {
        dispatch({ type: 'hydrate_start' })
        if (isSupabaseConfigured && supabase) {
          const [patientsResult, assessmentsResult] = await Promise.all([
            supabase.from('patients').select('*').eq('doctor_id', session.user.id).order('created_at', { ascending: false }),
            supabase.from('assessments').select('*').eq('doctor_id', session.user.id).order('assessed_at', { ascending: false }),
          ])
          dispatch({
            type: 'hydrate_success',
            patients: patientsResult.data ?? [],
            assessments: assessmentsResult.data ?? [],
          })
        } else {
          const stored = loadMockState()
          dispatch({
            type: 'hydrate_success',
            patients: (stored.patients ?? []).filter((patient) => patient.doctor_id === session.user.id),
            assessments: (stored.assessments ?? []).filter((assessment) => assessment.doctor_id === session.user.id),
          })
        }
      }
    },
    savePatientAndAssessment,
    saveAssessmentForPatient,
    deletePatient,
    getPatientById: (id) => state.patients.find((patient) => patient.id === id),
    getAssessmentsForPatient: (id) => state.assessments.filter((assessment) => assessment.patient_id === id).sort((left, right) => new Date(right.assessed_at) - new Date(left.assessed_at)),
  }

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const pushToast = (message, kind = 'success') => {
    const id = crypto.randomUUID()
    setToasts((current) => [...current, { id, message, kind }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 3600)
  }

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <ToastHost>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} $kind={toast.kind}>
            <strong>{toast.kind === 'error' ? 'Error' : 'Success'}</strong>
            <span>{toast.message}</span>
          </ToastItem>
        ))}
      </ToastHost>
    </ToastContext.Provider>
  )
}

function useAuth() {
  return useContext(AuthContext)
}

function useRecords() {
  return useContext(RecordsContext)
}

function useToasts() {
  return useContext(ToastContext)
}

function App() {
  return (
    <AuthProvider>
      <RecordsProvider>
        <ToastProvider>
          <GlobalStyle />
          <AppFrame>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/patients/new" element={<PatientCreatePage />} />
                <Route path="/patients/:patientId" element={<PatientDetailPage />} />
                <Route path="/patients/:patientId/assessment" element={<AssessmentPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AppFrame>
        </ToastProvider>
      </RecordsProvider>
    </AuthProvider>
  )
}

function ProtectedLayout() {
  const { session, loading } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (loading) {
    return (
      <Overlay>
        <OverlayCard>
          <Spinner />
          <div>
            <strong style={{ color: 'white', fontSize: 18 }}>Loading PhysioWatch</strong>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>Preparing secure ICU workspace...</p>
          </div>
        </OverlayCard>
      </Overlay>
    )
  }

  if (!session?.user) {
    return <Navigate to="/login" replace />
  }

  return (
    <ShellLayout $collapsed={sidebarCollapsed}>
      <SidebarBackdrop $open={sidebarOpen} onClick={() => setSidebarOpen(false)} aria-label="Close navigation drawer" />
      <Sidebar $open={sidebarOpen}>
        <BrandBlock>
          <TopBarCluster>
            <BrandMark>
              <Stethoscope size={24} strokeWidth={2.4} />
            </BrandMark>
            {!sidebarCollapsed && (
              <BrandTitle>
                <strong>PhysioWatch</strong>
                <span>Intelligent ICU Patient Monitoring</span>
              </BrandTitle>
            )}
          </TopBarCluster>
          {!sidebarCollapsed && <SubtleText>Abnormal health pattern detection for ICU doctors.</SubtleText>}
        </BrandBlock>

        <SidebarNav>
          <NavItem to="/dashboard" onClick={() => setSidebarOpen(false)}>
            <LayoutDashboard size={18} />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </NavItem>
          <NavItem to="/patients" onClick={() => setSidebarOpen(false)}>
            <Users size={18} />
            {!sidebarCollapsed && <span>Patients</span>}
          </NavItem>
          <NavItem to="/patients/new" onClick={() => setSidebarOpen(false)}>
            <Plus size={18} />
            {!sidebarCollapsed && <span>Add Patient</span>}
          </NavItem>
        </SidebarNav>

        <SidebarFooter>
          {!sidebarCollapsed && (
            <div style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: 'white', fontWeight: 700 }}>{session.user.email}</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>Secure doctor session</span>
            </div>
          )}
          <ActionButton $variant="ghost" onClick={() => setSidebarCollapsed((value) => !value)}>
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!sidebarCollapsed && <span>Collapse</span>}
          </ActionButton>
        </SidebarFooter>
      </Sidebar>

      <MainArea>
        <TopShell onMobileMenuClick={() => setSidebarOpen(true)} onToggleSidebar={() => setSidebarCollapsed((value) => !value)} />
        <Outlet />
      </MainArea>
    </ShellLayout>
  )
}

function TopShell({ onMobileMenuClick, onToggleSidebar }) {
  const { profile, logout } = useAuth()
  const { pushToast } = useToasts()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      pushToast('Signed out successfully.')
      navigate('/login')
    } catch (error) {
      pushToast(error.message || 'Unable to sign out.', 'error')
    }
  }

  return (
    <TopBar>
      <TopBarCluster>
        <CollapseButton onClick={onMobileMenuClick} aria-label="Open navigation">
          <Menu size={18} />
        </CollapseButton>
        <CollapseButton onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <PanelLeftOpen size={18} />
        </CollapseButton>
        <HeaderTitle>
          <strong>PhysioWatch</strong>
          <span>Welcome back, {profile?.full_name || 'Doctor'}</span>
        </HeaderTitle>
      </TopBarCluster>

      <HeaderActions>
        <ActionButton $variant="ghost" onClick={() => navigate('/patients/new')}>
          <Plus size={16} />
          New Patient
        </ActionButton>
        <ActionButton $variant="ghost" onClick={handleLogout}>
          <LogOut size={16} />
          Sign out
        </ActionButton>
      </HeaderActions>
    </TopBar>
  )
}

function LoginPage() {
  const { session, login, loading } = useAuth()
  const { pushToast } = useToasts()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (session?.user) navigate('/dashboard', { replace: true })
  }, [session, navigate])

  const submit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      pushToast('Logged in successfully.')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      pushToast(error.message || 'Login failed. Check your credentials.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout>
      <AuthHero>
        <div style={{ display: 'grid', gap: 18 }}>
          <AuthBadge>
            <ShieldCheck size={14} />
            ICU-grade access only
          </AuthBadge>
          <div style={{ display: 'grid', gap: 12, maxWidth: 560 }}>
            <h1 style={{ margin: 0, color: 'white', fontSize: 'clamp(42px, 8vw, 72px)', letterSpacing: '-0.06em', lineHeight: 0.95 }}>
              PhysioWatch
            </h1>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.72)', fontSize: 18, maxWidth: 520 }}>
              Intelligent ICU patient monitoring with abnormal pattern detection, assessment history, and a high-fidelity vital signs window.
            </p>
          </div>
        </div>

        <HeroMetrics>
          <HeroMetric>
            <strong>24</strong>
            <span>Time-step monitoring sequences</span>
          </HeroMetric>
          <HeroMetric>
            <strong>AI</strong>
            <span>Hugging Face model integration</span>
          </HeroMetric>
          <HeroMetric>
            <strong>RLS</strong>
            <span>Doctor-scoped patient records</span>
          </HeroMetric>
          <HeroMetric>
            <strong>WAT</strong>
            <span>Nigerian time for all assessments</span>
          </HeroMetric>
        </HeroMetrics>
      </AuthHero>

      <AuthFormCard>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'white' }}>
            <BrandMark style={{ width: 44, height: 44 }}>
              <HeartPulse size={22} strokeWidth={2.4} />
            </BrandMark>
            <div>
              <strong style={{ display: 'block', fontSize: 20 }}>Log in to PhysioWatch</strong>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>Intelligent ICU Patient Monitoring</span>
            </div>
          </div>
          {!isSupabaseConfigured && (
            <WarningLine>
              <CircleAlert size={14} />
              Supabase env vars are not configured. Demo mode is active.
            </WarningLine>
          )}
        </div>

        <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
          <Field>
            Email
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="doctor@hospital.org" required />
          </Field>
          <Field>
            Password
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" required />
          </Field>
          <ActionButton type="submit" disabled={submitting || loading}>
            {submitting ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
            {submitting ? 'Signing in...' : 'Login'}
          </ActionButton>
        </form>

        <SubtleText>
          Doctors are provisioned from Supabase Auth. If you are using demo mode, the app will open with seeded ICU patients and assessments.
        </SubtleText>
      </AuthFormCard>
    </AuthLayout>
  )
}

function DashboardPage() {
  const { patients, assessments, loading } = useRecords()
  const navigate = useNavigate()
  const latestAssessmentsByPatient = buildLatestAssessmentMap(assessments)
  const totalPatients = patients.length
  const normalPatients = patients.filter((patient) => patient.status === 'Normal').length
  const abnormalPatients = patients.filter((patient) => patient.status === 'Abnormal').length
  const assessmentsToday = assessments.filter((assessment) => formatWatDateKey(assessment.assessed_at) === formatWatDateKey(new Date())).length

  const recentPatients = [...patients]
    .map((patient) => ({
      ...patient,
      latestAssessment: latestAssessmentsByPatient.get(patient.id) || null,
    }))
    .sort((left, right) => new Date(right.latestAssessment?.assessed_at || right.created_at) - new Date(left.latestAssessment?.assessed_at || left.created_at))
    .slice(0, 5)

  return (
    <PageShell>
      <Grid $cols={12}>
        <MetricCard $span={3}>
          <MetricLabel><Users size={16} /> Total Patients</MetricLabel>
          <MetricValue>{loading ? '...' : totalPatients}</MetricValue>
          <SubtleText>All patients assigned to the logged-in doctor.</SubtleText>
        </MetricCard>
        <MetricCard $span={3} $accent>
          <MetricLabel><ShieldCheck size={16} /> Normal Patients</MetricLabel>
          <MetricValue>{loading ? '...' : normalPatients}</MetricValue>
          <SubtleText>Stable assessments and green status.</SubtleText>
        </MetricCard>
        <MetricCard $span={3}>
          <MetricLabel><BadgeAlert size={16} /> Abnormal Patients</MetricLabel>
          <MetricValue>{loading ? '...' : abnormalPatients}</MetricValue>
          <SubtleText>Requires clinical review and closer monitoring.</SubtleText>
        </MetricCard>
        <MetricCard $span={3}>
          <MetricLabel><CalendarDays size={16} /> Assessments Today</MetricLabel>
          <MetricValue>{loading ? '...' : assessmentsToday}</MetricValue>
          <SubtleText>Assessments recorded in Nigerian time.</SubtleText>
        </MetricCard>
      </Grid>

      <Grid $cols={12}>
        <SectionCard style={{ gridColumn: 'span 6' }}>
          <SectionHeader>
            <div>
              <h3>Patient Status Breakdown</h3>
              <p>Normal versus abnormal and pending cases.</p>
            </div>
          </SectionHeader>
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={buildStatusBreakdown(patients)} dataKey="value" nameKey="name" innerRadius={68} outerRadius={110} paddingAngle={3}>
                  {buildStatusBreakdown(patients).map((entry) => (
                    <Cell key={entry.name} fill={entry.name === 'Normal' ? '#10b981' : entry.name === 'Abnormal' ? '#ef4444' : '#64748b'} />
                  ))}
                </Pie>
                <RechartsTooltip content={<TooltipContent />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartBox>
        </SectionCard>

        <SectionCard style={{ gridColumn: 'span 6' }}>
          <SectionHeader>
            <div>
              <h3>Patients by Age Group</h3>
              <p>Demographic distribution in the assigned patient list.</p>
            </div>
          </SectionHeader>
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buildAgeGroups(patients)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="group" stroke="rgba(255,255,255,0.62)" />
                <YAxis stroke="rgba(255,255,255,0.62)" allowDecimals={false} />
                <RechartsTooltip content={<TooltipContent />} />
                <Bar dataKey="count" radius={[10, 10, 0, 0]} fill="#7cffb2" />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </SectionCard>

        <SectionCard style={{ gridColumn: 'span 6' }}>
          <SectionHeader>
            <div>
              <h3>Assessments Over Last 7 Days</h3>
              <p>Clinical workload and monitoring activity.
              </p>
            </div>
          </SectionHeader>
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={buildAssessmentTrend(assessments)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.62)" />
                <YAxis stroke="rgba(255,255,255,0.62)" allowDecimals={false} />
                <RechartsTooltip content={<TooltipContent />} />
                <Line type="monotone" dataKey="assessments" stroke="#7cffb2" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </SectionCard>

        <SectionCard style={{ gridColumn: 'span 6' }}>
          <SectionHeader>
            <div>
              <h3>Abnormal Patients by Risk Band</h3>
              <p>Confidence-driven severity buckets.</p>
            </div>
          </SectionHeader>
          <ChartBox>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buildRiskBatches(assessments.filter((assessment) => assessment.prediction === 'Abnormal'))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.62)" />
                <YAxis stroke="rgba(255,255,255,0.62)" allowDecimals={false} />
                <RechartsTooltip content={<TooltipContent />} />
                <Bar dataKey="count" radius={[10, 10, 0, 0]} fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </SectionCard>
      </Grid>

      <SectionCard>
        <SectionHeader>
          <div>
            <h3>Recent Patients</h3>
            <p>Last five patients assessed by this doctor.</p>
          </div>
          <ActionButton $variant="ghost" onClick={() => navigate('/patients')}>
            View all
          </ActionButton>
        </SectionHeader>
        {recentPatients.length === 0 ? (
          <EmptyState>
            <strong style={{ color: 'white' }}>No patients yet</strong>
            <span>Add a patient to begin monitoring and AI assessment.</span>
          </EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Last Assessment</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentPatients.map((patient) => (
                  <tr key={patient.id}>
                    <td>{patient.full_name}</td>
                    <td>{patient.age ?? '-'}</td>
                    <td>{patient.gender}</td>
                    <td>{patient.latestAssessment ? formatWatDateTime(patient.latestAssessment.assessed_at) : 'Pending'}</td>
                    <td><StatusChip $tone={patient.status === 'Normal' ? 'success' : patient.status === 'Abnormal' ? 'danger' : 'muted'}>{patient.status || 'Pending'}</StatusChip></td>
                    <td>{patient.latestAssessment ? `${Number(patient.latestAssessment.confidence).toFixed(1)}%` : '-'}</td>
                    <td><ActionButton $variant="ghost" onClick={() => navigate(`/patients/${patient.id}`)}>View</ActionButton></td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
    </PageShell>
  )
}

function PatientsPage() {
  const { patients, assessments, deletePatient, loading, syncing } = useRecords()
  const { pushToast } = useToasts()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  const [page, setPage] = useState(1)

  const filteredPatients = patients.filter((patient) => {
    const matchesName = patient.full_name.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'All' ? true : patient.status === filter
    return matchesName && matchesFilter
  })

  const pageSize = 10
  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize))
  const paginated = filteredPatients.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize)

  const handleDelete = async (patientId) => {
    if (!window.confirm('Delete this patient and all associated assessments?')) return
    try {
      await deletePatient(patientId)
      pushToast('Patient deleted successfully.')
    } catch (error) {
      pushToast(error.message || 'Unable to delete patient.', 'error')
    }
  }

  return (
    <PageShell>
      <SectionCard>
        <SectionHeader>
          <div>
            <h3>Patients</h3>
            <p>Search, filter, and manage all monitored patients.</p>
          </div>
          <ActionButton onClick={() => navigate('/patients/new')}>
            <Plus size={16} />
            Add New Patient
          </ActionButton>
        </SectionHeader>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <SearchField style={{ flex: 1 }}>
            <Search size={16} />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search by name" />
          </SearchField>
          <SearchField style={{ minWidth: 240 }}>
            <Filter size={16} />
            <select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1) }} style={{ width: '100%', background: 'transparent', border: 0, outline: 'none', color: 'white' }}>
              <option>All</option>
              <option>Normal</option>
              <option>Abnormal</option>
              <option>Pending</option>
            </select>
          </SearchField>
        </div>

        {loading ? (
          <EmptyState>
            <strong style={{ color: 'white' }}>Loading patients...</strong>
          </EmptyState>
        ) : paginated.length === 0 ? (
          <EmptyState>
            <strong style={{ color: 'white' }}>No patients match the current filters</strong>
            <span>Try clearing the search or add a new patient.</span>
          </EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Blood Type</th>
                  <th>Date Added</th>
                  <th>Last Assessment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((patient) => {
                  const latestAssessment = assessments.filter((assessment) => assessment.patient_id === patient.id).sort((left, right) => new Date(right.assessed_at) - new Date(left.assessed_at))[0]
                  return (
                    <tr key={patient.id}>
                      <td>{patient.full_name}</td>
                      <td>{patient.age ?? '-'}</td>
                      <td>{patient.gender}</td>
                      <td>{patient.blood_type || '-'}</td>
                      <td>{formatWatDateTime(patient.created_at)}</td>
                      <td>{latestAssessment ? formatWatDateTime(latestAssessment.assessed_at) : 'Pending'}</td>
                      <td><StatusChip $tone={patient.status === 'Normal' ? 'success' : patient.status === 'Abnormal' ? 'danger' : 'muted'}>{patient.status || 'Pending'}</StatusChip></td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <ActionButton $variant="ghost" onClick={() => navigate(`/patients/${patient.id}`)}><Eye size={16} />View</ActionButton>
                          <ActionButton $variant="ghost" onClick={() => handleDelete(patient.id)} disabled={syncing}><Trash2 size={16} />Delete</ActionButton>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          <SubtleText>
            Showing {paginated.length} of {filteredPatients.length} patients
          </SubtleText>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ActionButton $variant="ghost" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>
              <ChevronLeft size={16} /> Previous
            </ActionButton>
            <StatusChip $tone="muted">Page {page} of {totalPages}</StatusChip>
            <ActionButton $variant="ghost" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages}>
              Next <ChevronRight size={16} />
            </ActionButton>
          </div>
        </div>
      </SectionCard>
    </PageShell>
  )
}

function PatientCreatePage() {
  const { savePatientAndAssessment } = useRecords()
  const { pushToast } = useToasts()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (patientValues, vitalsValues) => {
    setSubmitting(true)
    try {
      const result = await savePatientAndAssessment(patientValues, vitalsValues)
      pushToast(`Assessment completed: ${result.assessment.prediction}.`)
      navigate(`/patients/${result.patient.id}`)
    } catch (error) {
      pushToast(error.message || 'Unable to save patient.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell>
      <PatientFormCard title="Add New Patient" description="Create the patient record, generate the 24-step sequence, and run the AI assessment in one flow." submitting={submitting} onSubmit={handleSubmit} />
    </PageShell>
  )
}

function PatientDetailPage() {
  const { patientId } = useParams()
  const { getPatientById, getAssessmentsForPatient, loading } = useRecords()
  const navigate = useNavigate()
  const patient = getPatientById(patientId)
  const assessments = getAssessmentsForPatient(patientId)
  const latestAssessment = assessments[0] || null
  const chartSeries = buildChartSeries(latestAssessment?.sequence_data)
  const [visibleSignals, setVisibleSignals] = useState(Object.fromEntries(VITALS.map((vital) => [vital.key, true])))

  if (loading) {
    return (
      <PageShell>
        <EmptyState><strong style={{ color: 'white' }}>Loading patient details...</strong></EmptyState>
      </PageShell>
    )
  }

  if (!patient) {
    return (
      <PageShell>
        <EmptyState>
          <strong style={{ color: 'white' }}>Patient not found</strong>
          <span>The requested patient record does not exist or you do not have access.</span>
          <div>
            <ActionButton onClick={() => navigate('/patients')}>
              Back to Patients
            </ActionButton>
          </div>
        </EmptyState>
      </PageShell>
    )
  }

  const lastVitals = latestAssessment || {}
  const cards = VITALS.map((vital) => {
    const currentValue = Number(lastVitals[vital.key]) || 0
    const status = getVitalStatus(currentValue, vital)
    const series = chartSeries.map((entry) => ({ value: entry[vital.key] }))
    return { vital, currentValue, status, series }
  })

  const historyRows = assessments.map((assessment) => ({
    ...assessment,
    watDate: formatWatDateTime(assessment.assessed_at),
  }))

  const toggleSignal = (key) => {
    setVisibleSignals((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <PageShell>
      <SectionCard>
        <SectionHeader>
          <div>
            <h3>Patient Profile</h3>
            <p>Core demographic and clinical record information.</p>
          </div>
          <ActionButton onClick={() => navigate(`/patients/${patient.id}/assessment`)}>
            <FlaskConical size={16} /> Run New Assessment
          </ActionButton>
        </SectionHeader>

        <Grid $cols={12}>
          <div style={{ gridColumn: 'span 4', display: 'grid', gap: 16 }}>
            <SectionCard style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 72, height: 72, borderRadius: 22, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, rgba(124,255,178,0.2), rgba(255,255,255,0.06))', border: '1px solid var(--border)' }}>
                  <strong style={{ color: 'white', fontSize: 24 }}>{initialsFromName(patient.full_name)}</strong>
                </div>
                <div>
                  <h4 style={{ margin: 0, color: 'white', fontSize: 24 }}>{patient.full_name}</h4>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)' }}>{patient.gender} · {patient.age ?? '-'} years · {patient.blood_type || 'Blood type pending'}</p>
                </div>
              </div>
            </SectionCard>
            <SectionCard style={{ padding: 18 }}>
              <div style={{ display: 'grid', gap: 10, color: 'rgba(255,255,255,0.82)' }}>
                <DetailRow label="Ward / Room" value={patient.ward_room || '-'} />
                <DetailRow label="Admission Date" value={patient.admission_date ? formatWatDateTime(patient.admission_date) : '-'} />
                <DetailRow label="Emergency Contact" value={`${patient.emergency_contact_name || '-'} · ${patient.emergency_contact_phone || '-'}`} />
              </div>
            </SectionCard>
          </div>

          <SectionCard style={{ gridColumn: 'span 8', display: 'grid', gap: 12 }}>
            <h4 style={{ margin: 0, color: 'white' }}>Clinical Summary</h4>
            <div style={{ display: 'grid', gap: 12 }}>
              <DetailRow label="Medical History" value={patient.medical_history || 'No history recorded.'} stacked />
              <DetailRow label="Known Allergies" value={patient.known_allergies || 'No allergies recorded.'} stacked />
            </div>
            <StepDivider />
            {latestAssessment ? (
              <RiskBanner $tone={latestAssessment.prediction === 'Abnormal' ? 'danger' : 'success'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <h3>{latestAssessment.prediction.toUpperCase()}</h3>
                  <StatusChip $tone={latestAssessment.prediction === 'Abnormal' ? 'danger' : 'success'}>{getRiskBand(Number(latestAssessment.confidence))}</StatusChip>
                </div>
                <p>{Number(latestAssessment.confidence).toFixed(1)}% confidence · Last assessment {formatWatDateTime(latestAssessment.assessed_at)}</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  <div>
                    <RangeHint><span>Normal probability</span><strong>{Number(latestAssessment.probability_normal).toFixed(1)}%</strong></RangeHint>
                    <ProgressTrack><ProgressFill $value={Number(latestAssessment.probability_normal)} $kind="success" /></ProgressTrack>
                  </div>
                  <div>
                    <RangeHint><span>Abnormal probability</span><strong>{Number(latestAssessment.probability_abnormal).toFixed(1)}%</strong></RangeHint>
                    <ProgressTrack><ProgressFill $value={Number(latestAssessment.probability_abnormal)} $kind="danger" /></ProgressTrack>
                  </div>
                </div>
              </RiskBanner>
            ) : (
              <EmptyState>
                <strong style={{ color: 'white' }}>No assessments yet</strong>
                <span>Run a new assessment to generate the monitoring window and risk banner.</span>
              </EmptyState>
            )}
          </SectionCard>
        </Grid>
      </SectionCard>

      <SectionCard>
        <SectionHeader>
          <div>
            <h3>24-Step Vital Signs Monitoring Window</h3>
            <p>The most important visualization in the product, animated and interactive.</p>
          </div>
        </SectionHeader>

        {chartSeries.length === 0 ? (
          <EmptyState>
            <strong style={{ color: 'white' }}>No sequence available</strong>
            <span>Run an assessment to populate the 24-step chart.</span>
          </EmptyState>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              {VITALS.map((vital) => (
                <TogglePill key={vital.key} $active={visibleSignals[vital.key]} onClick={() => toggleSignal(vital.key)}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: vital.color }} />
                  {vital.shortLabel}
                </TogglePill>
              ))}
            </div>

            <ChartBox $large>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="step" stroke="rgba(255,255,255,0.62)" />
                  <YAxis stroke="rgba(255,255,255,0.62)" />
                  <RechartsTooltip content={<VitalTooltip />} />
                  <Legend />
                  {VITALS.map((vital) =>
                    visibleSignals[vital.key] ? (
                      <Line key={vital.key} type="monotone" dataKey={vital.key} stroke={vital.color} strokeWidth={2.4} dot={false} isAnimationActive />
                    ) : null,
                  )}
                  {VITALS.map((vital) =>
                    visibleSignals[vital.key] ? (
                      <ReferenceLine key={`${vital.key}-min`} y={vital.min} stroke={vital.color} strokeDasharray="6 4" strokeOpacity={0.24} label={{ value: `${vital.shortLabel} min`, fill: vital.color, fontSize: 11 }} />
                    ) : null,
                  )}
                  {VITALS.map((vital) =>
                    visibleSignals[vital.key] ? (
                      <ReferenceLine key={`${vital.key}-max`} y={vital.max} stroke={vital.color} strokeDasharray="6 4" strokeOpacity={0.24} label={{ value: `${vital.shortLabel} max`, fill: vital.color, fontSize: 11 }} />
                    ) : null,
                  )}
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          </>
        )}
      </SectionCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 18 }}>
        {cards.map(({ vital, currentValue, status, series }) => (
          <MetricCard key={vital.key} $span={1}>
            <MetricLabel>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: vital.color }} />
              {vital.label}
            </MetricLabel>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <MetricValue style={{ fontSize: 26 }}>{currentValue || '-'}</MetricValue>
              <StatusChip $tone={status === 'Normal' ? 'success' : status === 'High' || status === 'Low' ? 'danger' : 'muted'}>{status}</StatusChip>
            </div>
            <SubtleText>Normal range {vital.min} - {vital.max} {vital.unit}</SubtleText>
            <div style={{ height: 56 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <Line dataKey="value" stroke={vital.color} strokeWidth={2} dot={false} isAnimationActive />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </MetricCard>
        ))}
      </div>

      <SectionCard>
        <SectionHeader>
          <div>
            <h3>Assessment History</h3>
            <p>All prior assessments for this patient.</p>
          </div>
          <ActionButton onClick={() => navigate(`/patients/${patient.id}/assessment`)}>
            <Plus size={16} /> New Assessment
          </ActionButton>
        </SectionHeader>

        {historyRows.length === 0 ? (
          <EmptyState>
            <strong style={{ color: 'white' }}>No assessment history yet</strong>
            <span>Use the new assessment button to record a clinical review.</span>
          </EmptyState>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>HR</th>
                  <th>BP</th>
                  <th>RR</th>
                  <th>SpO2</th>
                  <th>Result</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>{assessment.watDate.split(',')[0]}</td>
                    <td>{assessment.watDate.split(',')[1] || '-'}</td>
                    <td>{assessment.heart_rate}</td>
                    <td>{assessment.systolic_bp}/{assessment.diastolic_bp}</td>
                    <td>{assessment.respiratory_rate}</td>
                    <td>{assessment.spo2}</td>
                    <td><StatusChip $tone={assessment.prediction === 'Normal' ? 'success' : 'danger'}>{assessment.prediction}</StatusChip></td>
                    <td>{Number(assessment.confidence).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </SectionCard>
    </PageShell>
  )
}

function AssessmentPage() {
  const { patientId } = useParams()
  const { getPatientById, saveAssessmentForPatient } = useRecords()
  const { pushToast } = useToasts()
  const patient = getPatientById(patientId)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  if (!patient) {
    return (
      <PageShell>
        <EmptyState>
          <strong style={{ color: 'white' }}>Patient not found</strong>
          <span>The patient record could not be loaded.</span>
        </EmptyState>
      </PageShell>
    )
  }

  const handleSubmit = async (_patientValues, vitalsValues) => {
    setSubmitting(true)
    try {
      const next = await saveAssessmentForPatient(patient.id, vitalsValues)
      setResult(next.assessment)
      pushToast(`Assessment complete: ${next.assessment.prediction}.`)
    } catch (error) {
      pushToast(error.message || 'Unable to run assessment.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell>
      <SectionCard>
        <SectionHeader>
          <div>
            <h3>New Assessment</h3>
            <p>{patient.full_name} is pre-filled. Only the vital signs section is required.</p>
          </div>
        </SectionHeader>
        <PatientAssessmentForm key={patient.id} patient={patient} onSubmit={handleSubmit} submitting={submitting} inlineResult={result} assessmentMode />
      </SectionCard>
    </PageShell>
  )
}

function PatientFormCard({ title, description, submitting, onSubmit }) {
  return (
    <SectionCard>
      <SectionHeader>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </SectionHeader>
      <PatientAssessmentForm onSubmit={onSubmit} submitting={submitting} />
    </SectionCard>
  )
}

function PatientAssessmentForm({ patient, onSubmit, submitting, inlineResult, assessmentMode = false }) {
  const today = new Date().toISOString().slice(0, 10)
  const [patientValues, setPatientValues] = useState(() =>
    patient
      ? {
          full_name: patient.full_name,
          date_of_birth: patient.date_of_birth || '',
          gender: patient.gender || 'Male',
          blood_type: patient.blood_type || 'O+',
          height_cm: patient.height_cm || '',
          weight_kg: patient.weight_kg || '',
          medical_history: patient.medical_history || '',
          known_allergies: patient.known_allergies || '',
          emergency_contact_name: patient.emergency_contact_name || '',
          emergency_contact_phone: patient.emergency_contact_phone || '',
          admission_date: patient.admission_date || today,
          ward_room: patient.ward_room || '',
        }
      : {
          full_name: '',
          date_of_birth: '',
          gender: 'Male',
          blood_type: 'O+',
          height_cm: '',
          weight_kg: '',
          medical_history: '',
          known_allergies: '',
          emergency_contact_name: '',
          emergency_contact_phone: '',
          admission_date: today,
          ward_room: '',
        },
  )

  const [vitalsValues, setVitalsValues] = useState({ heart_rate: '', systolic_bp: '', diastolic_bp: '', respiratory_rate: '', spo2: '' })

  const submit = async (event) => {
    event.preventDefault()
    await onSubmit(patientValues, vitalsValues)
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 22 }}>
      {!assessmentMode && (
        <div>
          <h4 style={{ color: 'white', marginTop: 0 }}>Section A - Patient Information</h4>
          <InputGrid>
            <Field>
              Full Name
              <Input value={patientValues.full_name} onChange={(event) => setPatientValues((current) => ({ ...current, full_name: event.target.value }))} required />
            </Field>
            <Field>
              Date of Birth
              <Input type="date" value={patientValues.date_of_birth} onChange={(event) => setPatientValues((current) => ({ ...current, date_of_birth: event.target.value }))} />
              <span>Age will be calculated automatically from the date of birth.</span>
            </Field>
            <Field>
              Gender
              <Select value={patientValues.gender} onChange={(event) => setPatientValues((current) => ({ ...current, gender: event.target.value }))}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </Select>
            </Field>
            <Field>
              Blood Type
              <Select value={patientValues.blood_type} onChange={(event) => setPatientValues((current) => ({ ...current, blood_type: event.target.value }))}>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </Select>
            </Field>
            <Field>
              Height (cm)
              <Input type="number" value={patientValues.height_cm} onChange={(event) => setPatientValues((current) => ({ ...current, height_cm: event.target.value }))} />
            </Field>
            <Field>
              Weight (kg)
              <Input type="number" value={patientValues.weight_kg} onChange={(event) => setPatientValues((current) => ({ ...current, weight_kg: event.target.value }))} />
            </Field>
            <Field style={{ gridColumn: '1 / -1' }}>
              Medical History
              <Textarea value={patientValues.medical_history} onChange={(event) => setPatientValues((current) => ({ ...current, medical_history: event.target.value }))} />
            </Field>
            <Field style={{ gridColumn: '1 / -1' }}>
              Known Allergies
              <Textarea value={patientValues.known_allergies} onChange={(event) => setPatientValues((current) => ({ ...current, known_allergies: event.target.value }))} />
            </Field>
            <Field>
              Emergency Contact Name
              <Input value={patientValues.emergency_contact_name} onChange={(event) => setPatientValues((current) => ({ ...current, emergency_contact_name: event.target.value }))} />
            </Field>
            <Field>
              Emergency Contact Phone
              <Input value={patientValues.emergency_contact_phone} onChange={(event) => setPatientValues((current) => ({ ...current, emergency_contact_phone: event.target.value }))} />
            </Field>
            <Field>
              Admission Date
              <Input type="date" value={patientValues.admission_date} onChange={(event) => setPatientValues((current) => ({ ...current, admission_date: event.target.value }))} />
            </Field>
            <Field>
              Ward / Room Number
              <Input value={patientValues.ward_room} onChange={(event) => setPatientValues((current) => ({ ...current, ward_room: event.target.value }))} />
            </Field>
          </InputGrid>
          <StepDivider />
        </div>
      )}

      <div>
        <h4 style={{ color: 'white', marginTop: 0 }}>Section B - Vital Signs Input</h4>
        <SubtleText>Single-value input is expanded into a 24-step clinical monitoring sequence before assessment.</SubtleText>
        <InputGrid style={{ marginTop: 16 }}>
          {VITALS.map((vital) => {
            const value = vitalsValues[vital.key]
            const numericValue = Number(value)
            const outOfRange = value !== '' && Number.isFinite(numericValue) && (numericValue < vital.min || numericValue > vital.max)
            return (
              <Field key={vital.key}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{vital.label}</span>
                  {outOfRange ? (
                    <WarningLine><AlertTriangle size={14} /> Outside normal range</WarningLine>
                  ) : null}
                </span>
                <Input
                  type="number"
                  placeholder={vital.placeholder}
                  value={value}
                  onChange={(event) => setVitalsValues((current) => ({ ...current, [vital.key]: event.target.value }))}
                  required
                />
                <RangeHint>
                  <span>Normal range {vital.min} - {vital.max} {vital.unit}</span>
                  <span>{vital.shortLabel}</span>
                </RangeHint>
              </Field>
            )
          })}
        </InputGrid>
      </div>

      {inlineResult ? (
        <RiskBanner $tone={inlineResult.prediction === 'Abnormal' ? 'danger' : 'success'}>
          <h3>{inlineResult.prediction.toUpperCase()}</h3>
          <p>{Number(inlineResult.confidence).toFixed(1)}% confidence · {formatWatDateTime(inlineResult.assessed_at || new Date())}</p>
        </RiskBanner>
      ) : null}

      <ActionButton type="submit" disabled={submitting}>
        {submitting ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
        {submitting ? 'Running AI Assessment...' : 'Save Patient & Run Assessment'}
      </ActionButton>
    </form>
  )
}

function DetailRow({ label, value, stacked = false }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <span style={{ color: 'var(--muted-2)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ color: 'white', whiteSpace: stacked ? 'pre-wrap' : 'normal' }}>{value}</span>
    </div>
  )
}

function ChartBox({ children, $large = false }) {
  return (
    <div style={{ width: '100%', height: $large ? 480 : 320 }}>
      {children}
    </div>
  )
}

function TooltipContent({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ padding: 12, borderRadius: 14, background: 'rgba(3,7,18,0.96)', border: '1px solid var(--border)', color: 'white', boxShadow: 'var(--shadow)' }}>
      <strong style={{ display: 'block', marginBottom: 6 }}>Point {label}</strong>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'rgba(255,255,255,0.76)' }}>
          <span>{entry.name || entry.dataKey}</span>
          <span>{Number(entry.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

function VitalTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ padding: 12, borderRadius: 14, background: 'rgba(3,7,18,0.96)', border: '1px solid var(--border)', color: 'white', boxShadow: 'var(--shadow)' }}>
      <strong style={{ display: 'block', marginBottom: 6 }}>Step {label}</strong>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: 'rgba(255,255,255,0.76)' }}>
          <span>{entry.dataKey.replaceAll('_', ' ')}</span>
          <span>{Number(entry.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

function buildLatestAssessmentMap(assessments = []) {
  const latest = new Map()
  assessments
    .slice()
    .sort((left, right) => new Date(right.assessed_at) - new Date(left.assessed_at))
    .forEach((assessment) => {
      if (!latest.has(assessment.patient_id)) {
        latest.set(assessment.patient_id, assessment)
      }
    })
  return latest
}

export default App
