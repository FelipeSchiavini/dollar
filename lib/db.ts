import { JSONFilePreset } from 'lowdb/node'

export type UserConfig = {
  id: string
  // threshold: number // DEPRECATED
  alerts: AlertRule[]
  active: boolean
  phoneNumbers: string[] 
  whatsappSessions: string[] 
}

export type AlertRule = {
    id: string;
    type: 'RISE' | 'FALL' | 'ABOVE' | 'BELOW';
    value: number; // Absolute value for ABOVE/BELOW, Relative for RISE/FALL
    targetSession: string; 
    lastTriggeredValue?: number; 
}

export type HistoricalData = {
  timestamp: string
  bid: number
}

export type Data = {
  users: UserConfig[]
  history: HistoricalData[]
  lastBid: number
}

const defaultData: Data = { 
  users: [],
  history: [],
  lastBid: 0
}

export const getDb = async () => {
    const db = await JSONFilePreset<Data>('db.json', defaultData)
    return db
}
