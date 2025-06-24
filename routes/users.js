const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authorize, authorizeOwnerOrAdmin } = require('../middleware/auth');
const { validateChangePassword } = require('../validators/auth');

const router = express.Router();

/**
 * GET /api/users/profile
 * Buscar perfil do usuário logado
 */
router.get('/profile', asyncHandler(async (req, res) => {
  const { data: user, error } = await supabase
    .from('users')
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      role,
      is_active,
      last_login_at,
      email_verified_at,
      profile_picture_url,
      preferences,
      created_at,
      updated_at
    `)
    .eq('id', req.user.id)
    .single();

  if (error || !user) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  res.json({ user });
}));

/**
 * PUT /api/users/profile
 * Atualizar perfil do usuário logado
 */
router.put('/profile', asyncHandler(async (req, res) => {
  const updateData = {
    first_name: req.body.firstName,
    last_name: req.body.lastName,
    phone: req.body.phone,
    date_of_birth: req.body.dateOfBirth,
    profile_picture_url: req.body.profilePictureUrl,
    preferences: req.body.preferences
  };

  // Remover campos undefined
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // Validações básicas
  if (updateData.first_name && updateData.first_name.trim().length < 2) {
    throw new AppError('Nome deve ter pelo menos 2 caracteres', 400, 'INVALID_FIRST_NAME');
  }
  
  if (updateData.last_name && updateData.last_name.trim().length < 2) {
    throw new AppError('Sobrenome deve ter pelo menos 2 caracteres', 400, 'INVALID_LAST_NAME');
  }

  if (updateData.date_of_birth && new Date(updateData.date_of_birth) >= new Date()) {
    throw new AppError('Data de nascimento deve ser no passado', 400, 'INVALID_DATE_OF_BIRTH');
  }

  // Atualizar perfil
  const { data: user, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', req.user.id)
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      role,
      profile_picture_url,
      preferences,
      updated_at
    `)
    .single();

  if (error) {
    throw new AppError('Erro ao atualizar perfil: ' + error.message, 500, 'UPDATE_ERROR');
  }

  res.json({
    message: 'Perfil atualizado com sucesso',
    user
  });
}));

/**
 * PUT /api/users/change-password
 * Alterar senha do usuário logado
 */
router.put('/change-password', asyncHandler(async (req, res) => {
  // Validar dados de entrada
  const { error, value } = validateChangePassword(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: error.details.map(d => d.message)
    });
  }

  const { currentPassword, newPassword } = value;

  // Buscar senha atual do usuário
  const { data: userData, error: fetchError } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', req.user.id)
    .single();

  if (fetchError || !userData) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  // Verificar senha atual
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, userData.password_hash);
  if (!isCurrentPasswordValid) {
    throw new AppError('Senha atual incorreta', 400, 'INVALID_CURRENT_PASSWORD');
  }

  // Hash da nova senha
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // Atualizar senha na nossa tabela
  const { error: updateError } = await supabase
    .from('users')
    .update({ password_hash: newPasswordHash })
    .eq('id', req.user.id);

  if (updateError) {
    throw new AppError('Erro ao atualizar senha: ' + updateError.message, 500, 'UPDATE_ERROR');
  }

  res.json({
    message: 'Senha alterada com sucesso'
  });
}));

/**
 * GET /api/users
 * Listar usuários (apenas admins)
 */
router.get('/', authorize('admin'), asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    role,
    is_active,
    search,
    sort_by = 'created_at',
    sort_order = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Construir query base
  let query = supabase
    .from('users')
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      role,
      is_active,
      last_login_at,
      email_verified_at,
      created_at
    `, { count: 'exact' })
    .is('deleted_at', null);

  // Aplicar filtros
  if (role) {
    query = query.eq('role', role);
  }
  
  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true');
  }
  
  // Busca por texto
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
  }
  
  // Ordenação
  query = query.order(sort_by, { ascending: sort_order === 'asc' });
  
  // Paginação
  query = query.range(offset, offset + limit - 1);

  const { data: users, error, count } = await query;

  if (error) {
    throw new AppError('Erro ao buscar usuários: ' + error.message, 500, 'FETCH_ERROR');
  }

  res.json({
    users,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / limit)
    }
  });
}));

/**
 * GET /api/users/:id
 * Buscar usuário específico
 */
router.get('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: user, error } = await supabase
    .from('users')
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      role,
      is_active,
      last_login_at,
      email_verified_at,
      profile_picture_url,
      preferences,
      created_at,
      updated_at
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !user) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  // Buscar estatísticas de reservas do usuário
  const { data: bookingStats } = await supabase
    .from('bookings')
    .select('status, total_amount, quantity')
    .eq('user_id', id)
    .is('deleted_at', null);

  const stats = {
    totalBookings: bookingStats?.length || 0,
    totalSpent: bookingStats?.reduce((sum, booking) => sum + parseFloat(booking.total_amount || 0), 0) || 0,
    totalTickets: bookingStats?.reduce((sum, booking) => sum + (booking.quantity || 0), 0) || 0,
    confirmedBookings: bookingStats?.filter(b => b.status === 'confirmed').length || 0,
    cancelledBookings: bookingStats?.filter(b => b.status === 'cancelled').length || 0
  };

  res.json({ 
    user,
    stats 
  });
}));

/**
 * PUT /api/users/:id
 * Atualizar usuário (apenas admins)
 */
router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Buscar usuário atual
  const { data: currentUser, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !currentUser) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  const updateData = {
    first_name: req.body.firstName,
    last_name: req.body.lastName,
    phone: req.body.phone,
    date_of_birth: req.body.dateOfBirth,
    role: req.body.role,
    is_active: req.body.isActive,
    profile_picture_url: req.body.profilePictureUrl,
    preferences: req.body.preferences
  };

  // Remover campos undefined
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  // Validações
  if (updateData.first_name && updateData.first_name.trim().length < 2) {
    throw new AppError('Nome deve ter pelo menos 2 caracteres', 400, 'INVALID_FIRST_NAME');
  }
  
  if (updateData.last_name && updateData.last_name.trim().length < 2) {
    throw new AppError('Sobrenome deve ter pelo menos 2 caracteres', 400, 'INVALID_LAST_NAME');
  }

  if (updateData.role && !['customer', 'venue_manager', 'admin'].includes(updateData.role)) {
    throw new AppError('Papel de usuário inválido', 400, 'INVALID_ROLE');
  }

  // Atualizar usuário
  const { data: user, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select(`
      id,
      first_name,
      last_name,
      email,
      phone,
      date_of_birth,
      role,
      is_active,
      profile_picture_url,
      preferences,
      updated_at
    `)
    .single();

  if (error) {
    throw new AppError('Erro ao atualizar usuário: ' + error.message, 500, 'UPDATE_ERROR');
  }

  res.json({
    message: 'Usuário atualizado com sucesso',
    user
  });
}));

/**
 * DELETE /api/users/:id
 * Deletar usuário (soft delete, apenas admins)
 */
router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Não permitir que admin delete a si mesmo
  if (id === req.user.id) {
    throw new AppError('Não é possível deletar sua própria conta', 400, 'CANNOT_DELETE_SELF');
  }

  // Buscar usuário
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !user) {
    throw new AppError('Usuário não encontrado', 404, 'USER_NOT_FOUND');
  }

  // Verificar se há reservas ativas
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('user_id', id)
    .in('status', ['pending', 'confirmed'])
    .is('deleted_at', null);

  if (activeBookings && activeBookings.length > 0) {
    throw new AppError('Não é possível deletar usuário com reservas ativas', 400, 'USER_HAS_ACTIVE_BOOKINGS');
  }

  // Soft delete
  const { error } = await supabase
    .from('users')
    .update({ 
      deleted_at: new Date().toISOString(),
      is_active: false 
    })
    .eq('id', id);

  if (error) {
    throw new AppError('Erro ao deletar usuário: ' + error.message, 500, 'DELETE_ERROR');
  }

  res.json({
    message: 'Usuário deletado com sucesso'
  });
}));

/**
 * GET /api/users/:id/bookings
 * Listar reservas de um usuário (admin ou próprio usuário)
 */
router.get('/:id/bookings', authorizeOwnerOrAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    page = 1,
    limit = 10,
    status,
    start_date,
    end_date,
    sort_by = 'booked_at',
    sort_order = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Construir query
  let query = supabase
    .from('bookings')
    .select(`
      *,
      events (
        id,
        title,
        type,
        start_date_time,
        end_date_time,
        venues (
          id,
          name,
          city,
          state
        )
      )
    `, { count: 'exact' })
    .eq('user_id', id)
    .is('deleted_at', null);

  // Aplicar filtros
  if (status) {
    query = query.eq('status', status);
  }
  
  if (start_date) {
    query = query.gte('booked_at', start_date);
  }
  
  if (end_date) {
    query = query.lte('booked_at', end_date);
  }
  
  // Ordenação
  query = query.order(sort_by, { ascending: sort_order === 'asc' });
  
  // Paginação
  query = query.range(offset, offset + limit - 1);

  const { data: bookings, error, count } = await query;

  if (error) {
    throw new AppError('Erro ao buscar reservas: ' + error.message, 500, 'FETCH_ERROR');
  }

  res.json({
    bookings,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / limit)
    }
  });
}));

module.exports = router;