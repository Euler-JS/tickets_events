const express = require('express');
const { supabase } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/events
 * Listar eventos (com filtros e paginação)
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    type,
    venue_id,
    city,
    status = 'published',
    start_date,
    end_date,
    search,
    sort_by = 'start_date_time',
    sort_order = 'asc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Construir query base
  let query = supabase
    .from('events')
    .select(`
      *,
      venues (
        id,
        name,
        type,
        city,
        state,
        country,
        capacity,
        address
      )
    `, { count: 'exact' })
    .eq('is_active', true)
    .is('deleted_at', null);

  // Aplicar filtros
  if (status) {
    query = query.eq('status', status);
  }
  
  if (type) {
    query = query.eq('type', type);
  }
  
  if (venue_id) {
    query = query.eq('venue_id', venue_id);
  }
  
  if (city) {
    query = query.eq('venues.city', city);
  }
  
  if (start_date) {
    query = query.gte('start_date_time', start_date);
  }
  
  if (end_date) {
    query = query.lte('start_date_time', end_date);
  }
  
  // Busca por texto
  if (search) {
    query = query.ilike('title', `%${search}%`);
  }
  
  // Filtrar apenas eventos futuros por padrão
  query = query.gte('start_date_time', new Date().toISOString());
  
  // Ordenação
  query = query.order(sort_by, { ascending: sort_order === 'asc' });
  
  // Paginação
  query = query.range(offset, offset + limit - 1);

  const { data: events, error, count } = await query;

  if (error) {
    throw new AppError('Erro ao buscar eventos: ' + error.message, 500, 'FETCH_ERROR');
  }

  res.json({
    events,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / limit)
    }
  });
}));

/**
 * GET /api/events/:id
 * Buscar evento específico
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: event, error } = await supabase
    .from('events')
    .select(`
      *,
      venues (
        id,
        name,
        type,
        address,
        city,
        state,
        country,
        capacity,
        amenities,
        contact_info
      )
    `)
    .eq('id', id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (error || !event) {
    throw new AppError('Evento não encontrado', 404, 'EVENT_NOT_FOUND');
  }

  // Se não for admin/venue_manager, só mostrar eventos publicados
  if (req.user.role === 'customer' && event.status !== 'published') {
    throw new AppError('Evento não encontrado', 404, 'EVENT_NOT_FOUND');
  }

  res.json({ event });
}));

/**
 * POST /api/events
 * Criar novo evento (apenas venue_managers e admins)
 */
router.post('/', authorize('venue_manager', 'admin'), asyncHandler(async (req, res) => {
  const eventData = {
    title: req.body.title,
    description: req.body.description,
    type: req.body.type,
    category: req.body.category,
    start_date_time: req.body.start_date_time,
    end_date_time: req.body.end_date_time,
    age_rating: req.body.age_rating,
    language: req.body.language,
    subtitles: req.body.subtitles || [],
    poster_url: req.body.poster_url,
    trailer_url: req.body.trailer_url,
    price: req.body.price,
    currency: req.body.currency || 'USD',
    available_tickets: req.body.available_tickets,
    max_tickets_per_user: req.body.max_tickets_per_user || 10,
    venue_id: req.body.venue_id,
    metadata: req.body.metadata || {}
  };

  // Verificar se o venue existe e se o usuário tem permissão
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('id, manager_id')
    .eq('id', eventData.venue_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (venueError || !venue) {
    throw new AppError('Local não encontrado', 404, 'VENUE_NOT_FOUND');
  }

  // Verificar permissões (venue_manager só pode criar no seu venue)
  if (req.user.role === 'venue_manager' && venue.manager_id !== req.user.id) {
    throw new AppError('Sem permissão para criar eventos neste local', 403, 'VENUE_ACCESS_DENIED');
  }

  // Validar datas
  const startDate = new Date(eventData.start_date_time);
  const endDate = new Date(eventData.end_date_time);
  const now = new Date();

  if (startDate <= now) {
    throw new AppError('Data de início deve ser no futuro', 400, 'INVALID_START_DATE');
  }

  if (endDate <= startDate) {
    throw new AppError('Data de fim deve ser após a data de início', 400, 'INVALID_END_DATE');
  }

  // Verificar se não há conflito de horário no venue
  const { data: conflictingEvents } = await supabase
    .from('events')
    .select('id, title')
    .eq('venue_id', eventData.venue_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .or(`start_date_time.lte.${eventData.end_date_time},end_date_time.gte.${eventData.start_date_time}`);

  if (conflictingEvents && conflictingEvents.length > 0) {
    throw new AppError('Horário conflita com outro evento no mesmo local', 409, 'SCHEDULE_CONFLICT');
  }

  // Criar evento
  const { data: event, error } = await supabase
    .from('events')
    .insert(eventData)
    .select(`
      *,
      venues (
        id,
        name,
        type,
        city,
        state,
        country
      )
    `)
    .single();

  if (error) {
    throw new AppError('Erro ao criar evento: ' + error.message, 500, 'CREATE_ERROR');
  }

  res.status(201).json({
    message: 'Evento criado com sucesso',
    event
  });
}));

/**
 * PUT /api/events/:id
 * Atualizar evento
 */
router.put('/:id', authorize('venue_manager', 'admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Buscar evento atual
  const { data: currentEvent, error: fetchError } = await supabase
    .from('events')
    .select(`
      *,
      venues (id, manager_id)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (fetchError || !currentEvent) {
    throw new AppError('Evento não encontrado', 404, 'EVENT_NOT_FOUND');
  }

  // Verificar permissões
  if (req.user.role === 'venue_manager' && currentEvent.venues.manager_id !== req.user.id) {
    throw new AppError('Sem permissão para editar este evento', 403, 'EVENT_ACCESS_DENIED');
  }

  const updateData = {
    title: req.body.title,
    description: req.body.description,
    type: req.body.type,
    category: req.body.category,
    start_date_time: req.body.start_date_time,
    end_date_time: req.body.end_date_time,
    age_rating: req.body.age_rating,
    language: req.body.language,
    subtitles: req.body.subtitles,
    poster_url: req.body.poster_url,
    trailer_url: req.body.trailer_url,
    price: req.body.price,
    currency: req.body.currency,
    available_tickets: req.body.available_tickets,
    max_tickets_per_user: req.body.max_tickets_per_user,
    status: req.body.status,
    metadata: req.body.metadata
  };

  // Remover campos undefined
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // Atualizar evento
  const { data: event, error } = await supabase
    .from('events')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      venues (
        id,
        name,
        type,
        city,
        state,
        country
      )
    `)
    .single();

  if (error) {
    throw new AppError('Erro ao atualizar evento: ' + error.message, 500, 'UPDATE_ERROR');
  }

  res.json({
    message: 'Evento atualizado com sucesso',
    event
  });
}));

/**
 * DELETE /api/events/:id
 * Deletar evento (soft delete)
 */
router.delete('/:id', authorize('venue_manager', 'admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Buscar evento
  const { data: event, error: fetchError } = await supabase
    .from('events')
    .select(`
      *,
      venues (id, manager_id)
    `)
    .eq('id', id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (fetchError || !event) {
    throw new AppError('Evento não encontrado', 404, 'EVENT_NOT_FOUND');
  }

  // Verificar permissões
  if (req.user.role === 'venue_manager' && event.venues.manager_id !== req.user.id) {
    throw new AppError('Sem permissão para deletar este evento', 403, 'EVENT_ACCESS_DENIED');
  }

  // Verificar se há reservas confirmadas
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('event_id', id)
    .in('status', ['confirmed', 'pending'])
    .is('deleted_at', null);

  if (bookings && bookings.length > 0) {
    throw new AppError('Não é possível deletar evento com reservas ativas', 400, 'EVENT_HAS_BOOKINGS');
  }

  // Soft delete
  const { error } = await supabase
    .from('events')
    .update({ 
      deleted_at: new Date().toISOString(),
      is_active: false 
    })
    .eq('id', id);

  if (error) {
    throw new AppError('Erro ao deletar evento: ' + error.message, 500, 'DELETE_ERROR');
  }

  res.json({
    message: 'Evento deletado com sucesso'
  });
}));

module.exports = router;