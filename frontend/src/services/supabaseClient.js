// ============================================================
// SUPABASE CLIENT - Persistance du bot
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase non configuré - pas de persistance')
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null

// Sauvegarder l'état du bot
export async function saveBotState(userId, botState, openPositions, trades) {
  if (!supabase) return false
  
  try {
    const { error } = await supabase
      .from('bot_states')
      .upsert({
        user_id: userId,
        bot_state: botState,
        open_positions: openPositions,
        trades: trades.slice(0, 50), // Garder les 50 derniers trades
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Erreur sauvegarde Supabase:', error)
    return false
  }
}

// Charger l'état du bot
export async function loadBotState(userId) {
  if (!supabase) return null
  
  try {
    const { data, error } = await supabase
      .from('bot_states')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  } catch (error) {
    console.error('Erreur chargement Supabase:', error)
    return null
  }
}

// Sauvegarder un trade
export async function saveTrade(userId, trade) {
  if (!supabase) return false
  
  try {
    const { error } = await supabase
      .from('trades')
      .insert({
        user_id: userId,
        ...trade,
        created_at: new Date().toISOString()
      })
    
    if (error) throw error
    return true
  } catch (error) {
    console.error('Erreur sauvegarde trade:', error)
    return false
  }
}

export default supabase
