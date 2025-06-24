const express = require('express');
const { supabase } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/venues
 * Listar venues
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    type,
    city,
    state,
    country,
    search,
    sort_by = 'name',
    sort_order = 'asc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Construir query base
  let query = supabase
    .from('venues')
    .select('*', { count: 'exact' })
    .eq('is_active', true)
    .is('deleted_at', null);

  // Aplicar filtros
  if (type) {
    query = query.eq('type', type);
  }
  
  if (city) {
    query = query.ilike('city', `%${city}%`);
  }
  
  if (state) {
    query = query.ilike('state', `%${state}%`);
  }
  
  if (country) {
    query = query.ilike('country', `%${country}%`);
  }
  
  // Busca por texto
  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,address.ilike.%${search}%`);
  }
  
  // Ordenação
  query = query.order(sort_by, { ascending: sort_order === 'asc' });
  
  // Paginação
  query = query.range(offset, offset + limit - 1);

  const { data: venues, error, count } = await query;

  if (error) {
    throw new AppError('Erro ao buscar venues: ' + error.message, 500, 'FETCH_ERROR');
  }

  res.json({
    venues,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / limit)
    }
  });
}));

/**
 * GET /api/venues/:id
 * Buscar venue específico
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: venue, error } = await supabase
    .from('venues')
    .select(`
      *,
      users (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq('id', id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (error || !venue) {
    throw new AppError('Venue não encontrado', 404, 'VENUE_NOT_FOUND');
  }

  // Buscar estatísticas básicas do venue
  const { data: stats } = await supabase
    .rpc('get_sales_stats', {
      p_venue_id: id,
      p_start_date: null,
      p_end_date: null
    });

  res.json({ 
    venue,
    stats: stats?.[0] || null
  });
}));

/**
 * POST /api/venues
 * Criar novo venue (apenas admins)
 */
router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const venueData = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
    address: req.body.address,
    city: req.body.city,
    state: req.body.state,
    country: req.body.country,
    postal_code: req.body.postal_code,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    capacity: req.body.capacity,
    amenities: req.body.amenities || [],
    contact_info: req.body.contact_info || {},
    manager_id: req.body.manager_id,
    metadata: req.body.metadata || {}
  };

  // Validações básicas
  if (!venueData.name || !venueData.type || !venueData.address || !venueData.capacity) {
    throw new AppError('Nome, tipo, endereço e capacidade são obrigatórios', 400, 'MISSING_REQUIRED_FIELDS');
  }

  if (venueData.capacity <= 0) {
    throw new AppError('Capacidade deve ser maior que zero', 400, 'INVALID_CAPACITY');
  }

  // Verificar se manager existe (se fornecido)
  if (venueData.manager_id) {
    const { data: manager, error: managerError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', venueData.manager_id)
      .eq('is_active', true)
      .single();

    if (managerError || !manager) {
      throw new AppError('Gerente não encontrado', 404, 'MANAGER_NOT_FOUND');
    }

    if (manager.role !== 'venue_manager' && manager.role !== 'admin') {
      throw new AppError('Usuário deve ter papel de venue_manager ou admin', 400, 'INVALID_MANAGER_ROLE');
    }
  }

  // Criar venue
  const { data: venue, error } = await supabase
    .from('venues')
    .insert(venueData)
    .select()
    .single();

  if (error) {
    throw new AppError('Erro ao criar venue: ' + error.message, 500, 'CREATE_ERROR');
  }

  res.status(201).json({
    message: 'Venue criado com sucesso',
    venue
  });
}));

/**
 * PUT /api/venues/:id
 * Atualizar venue
 */
router.put('/:id', authorize('venue_manager', 'admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Buscar venue atual
  const { data: currentVenue, error: fetchError } = await supabase
    .from('venues')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (fetchError || !currentVenue) {
    throw new AppError('Venue não encontrado', 404, 'VENUE_NOT_FOUND');
  }

  // Verificar permissões (venue_manager só pode editar seu próprio venue)
  if (req.user.role === 'venue_manager' && currentVenue.manager_id !== req.user.id) {
    throw new AppError('Sem permissão para editar este venue', 403, 'VENUE_ACCESS_DENIED');
  }

  const updateData = {
    name: req.body.name,
    type: req.body.type,
    description: req.body.description,
    address: req.body.address,
    city: req.body.city,
    state: req.body.state,
    country: req.body.country,
    postal_code: req.body.postal_code,
    latitude: req.body.latitude,
    longitude: req.body.longitude,
    capacity: req.body.capacity,
    amenities: req.body.amenities,
    contact_info: req.body.contact_info,
    manager_id: req.body.manager_id,
    metadata: req.body.metadata
  };

  // Remover campos undefined
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // Validar capacidade se fornecida
  if (updateData.capacity !== undefined && updateData.capacity <= 0) {
    throw new AppError('Capacidade deve ser maior que zero', 400, 'INVALID_CAPACITY');
  }

  // Verificar se novo manager existe (se fornecido)
  if (updateData.manager_id && updateData.manager_id !== currentVenue.manager_id) {
    const { data: manager, error: managerError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', updateData.manager_id)
      .eq('is_active', true)
      .single();

    if (managerError || !manager) {
      throw new AppError('Gerente não encontrado', 404, 'MANAGER_NOT_FOUND');
    }

    if (manager.role !== 'venue_manager' && manager.role !== 'admin') {
      throw new AppError('Usuário deve ter papel de venue_manager ou admin', 400, 'INVALID_MANAGER_ROLE');
    }
  }

  // Atualizar venue
  const { data: venue, error } = await supabase
    .from('venues')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('Erro ao atualizar venue: ' + error.message, 500, 'UPDATE_ERROR');
  }

  res.json({
    message: 'Venue atualizado com sucesso',
    venue
  });
}));

/**
 * DELETE /api/venues/:id
 * Deletar venue (soft delete)
 */
router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Buscar venue
  const { data: venue, error: fetchError } = await supabase
    .from('venues')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (fetchError || !venue) {
    throw new AppError('Venue não encontrado', 404, 'VENUE_NOT_FOUND');
  }

  // Verificar se há eventos futuros
  const { data: futureEvents } = await supabase
    .from('events')
    .select('id')
    .eq('venue_id', id)
    .gte('start_date_time', new Date().toISOString())
    .eq('is_active', true)
    .is('deleted_at', null);

  if (futureEvents && futureEvents.length > 0) {
    throw new AppError('Não é possível deletar venue com eventos futuros', 400, 'VENUE_HAS_FUTURE_EVENTS');
  }

  // Soft delete
  const { error } = await supabase
    .from('venues')
    .update({ 
      deleted_at: new Date().toISOString(),
      is_active: false 
    })
    .eq('id', id);

  if (error) {
    throw new AppError('Erro ao deletar venue: ' + error.message, 500, 'DELETE_ERROR');
  }

  res.json({
    message: 'Venue deletado com sucesso'
  });
}));

/**
 * GET /api/venues/:id/events
 * Listar eventos de um venue
 */
router.get('/:id/events', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    limit = 10,
    status,
    start_date,
    end_date,
    sort_by = 'start_date_time',
    sort_order = 'asc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Verificar se venue existe
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('id')
    .eq('id', id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single();

  if (venueError || !venue) {
    throw new AppError('Venue não encontrado', 404, 'VENUE_NOT_FOUND');
  }

  // Construir query para eventos
  let query = supabase
    .from('events')
    .select('*', { count: 'exact' })
    .eq('venue_id', id)
    .eq('is_active', true)
    .is('deleted_at', null);

  // Aplicar filtros
  if (status) {
    query = query.eq('status', status);
  } else {
    // Por padrão, mostrar apenas eventos publicados para não-administradores
    if (req.user.role === 'customer') {
      query = query.eq('status', 'published');
    }
  }
  
  if (start_date) {
    query = query.gte('start_date_time', start_date);
  }
  
  if (end_date) {
    query = query.lte('start_date_time', end_date);
  }
  
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

module.exports = router;