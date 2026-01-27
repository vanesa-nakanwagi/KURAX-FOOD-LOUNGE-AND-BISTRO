import { supabase } from '../../../lib/supabaseClient'

/* ==========================
   STAFF FUNCTIONS
========================== */
export async function getStaff(authUserId) {
  const { data, error } = await supabase
    .from('kurax-staff')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()
  if (error) throw error
  return data
}

/* ==========================
   IMAGE UPLOAD
========================== */
export async function uploadImage(file, folder = 'menus') {
  if (!file) return null

  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}.${fileExt}`
  const filePath = `${folder}/${fileName}`

  // Upload file to Supabase Storage
  const { data, error } = await supabase.storage
    .from('menu-images') // or event-images bucket if you prefer
    .upload(filePath, file)

  if (error) throw error

  // Get public URL
  const { publicUrl, error: urlError } = supabase.storage
    .from('menu-images')
    .getPublicUrl(filePath)

  if (urlError) throw urlError
  return publicUrl
}

/* ==========================
   MENUS FUNCTIONS
========================== */
export async function getMenus() {
  const { data, error } = await supabase.from('menus').select('*')
  if (error) throw error
  return data
}

export async function addMenu(menu) {
  /*
    menu = {
      name: string,
      description: string,
      price: number,
      category: string,
      image_url: string (optional),
      published: boolean
    }
  */
  const { data, error } = await supabase.from('menus').insert([menu])
  if (error) throw error
  return data
}

export async function updateMenu(id, updatedMenu) {
  const { data, error } = await supabase
    .from('menus')
    .update(updatedMenu)
    .eq('id', id)
  if (error) throw error
  return data
}

export async function deleteMenu(id) {
  const { data, error } = await supabase.from('menus').delete().eq('id', id)
  if (error) throw error
  return data
}

/* ==========================
   EVENTS FUNCTIONS
========================== */
export async function getEvents() {
  const { data, error } = await supabase.from('events').select('*')
  if (error) throw error
  return data
}

export async function addEvent(event) {
  /*
    event = {
      title: string,
      description: string,
      date: string or Date,
      image_url: string (optional),
      published: boolean
    }
  */
  const { data, error } = await supabase.from('events').insert([event])
  if (error) throw error
  return data
}

export async function updateEvent(id, updatedEvent) {
  const { data, error } = await supabase
    .from('events')
    .update(updatedEvent)
    .eq('id', id)
  if (error) throw error
  return data
}

export async function deleteEvent(id) {
  const { data, error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
  return data
}
