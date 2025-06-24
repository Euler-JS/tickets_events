const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase, supabaseAdmin } = require('../config/supabase'); // CORRIGIDO: sem src/
const { asyncHandler, AppError } = require('../middleware/errorHandler'); // CORRIGIDO: sem src/
const { validateRegister, validateLogin } = require('../validators/auth'); // CORRIGIDO: sem src/

const router = express.Router();

/**
 * POST /api/auth/register
 * Registrar novo usuário
 */
router.post('/register', asyncHandler(async (req, res) => {
  // Validar dados de entrada
  const { error, value } = validateRegister(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: error.details.map(d => d.message)
    });
  }

  const { email, password, firstName, lastName, phone, dateOfBirth } = value;

  // Verificar se email já existe
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    throw new AppError('Email já está em uso', 409, 'EMAIL_EXISTS');
  }

  // Hash da senha
  const passwordHash = await bcrypt.hash(password, 12);

  // Criar usuário na tabela users
  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      password_hash: passwordHash,
      phone,
      date_of_birth: dateOfBirth,
      role: 'customer',
      is_active: true
    })
    .select('id, first_name, last_name, email, role, created_at')
    .single();

  if (userError) {
    throw new AppError('Erro ao criar conta: ' + userError.message, 500, 'CREATE_USER_ERROR');
  }

  res.status(201).json({
    message: 'Conta criada com sucesso',
    user: userData
  });
}));

/**
 * POST /api/auth/login
 * Fazer login
 */
router.post('/login', asyncHandler(async (req, res) => {
  // Validar dados de entrada
  const { error, value } = validateLogin(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: error.details.map(d => d.message)
    });
  }

  const { email, password } = value;

  // Buscar usuário na tabela users
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, password_hash, role, is_active, last_login_at')
    .eq('email', email)
    .single();

  if (userError || !userData) {
    throw new AppError('Email ou senha incorretos', 401, 'INVALID_CREDENTIALS');
  }

  if (!userData.is_active) {
    throw new AppError('Conta desativada', 403, 'ACCOUNT_DISABLED');
  }

  // Verificar senha
  const isValidPassword = await bcrypt.compare(password, userData.password_hash);
  if (!isValidPassword) {
    throw new AppError('Email ou senha incorretos', 401, 'INVALID_CREDENTIALS');
  }

  // Atualizar last_login_at
  await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', userData.id);

  // Remover password_hash da resposta
  const { password_hash, ...userResponse } = userData;

  // Definir cookie com dados do usuário
  res.cookie('user_session', JSON.stringify({
    id: userData.id,
    email: userData.email,
    role: userData.role,
    first_name: userData.first_name,
    last_name: userData.last_name
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    sameSite: 'lax'
  });

  res.json({
    message: 'Login realizado com sucesso',
    user: userResponse
  });
}));

/**
 * POST /api/auth/logout
 * Fazer logout
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    // Fazer logout no Supabase
    await supabase.auth.admin.signOut(token);
  }

  res.json({
    message: 'Logout realizado com sucesso'
  });
}));

/**
 * POST /api/auth/refresh
 * Renovar token
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    throw new AppError('Refresh token requerido', 400, 'MISSING_REFRESH_TOKEN');
  }

  // Renovar sessão
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token
  });

  if (error) {
    throw new AppError('Token inválido', 401, 'INVALID_REFRESH_TOKEN');
  }

  res.json({
    message: 'Token renovado com sucesso',
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at
    }
  });
}));

/**
 * POST /api/auth/forgot-password
 * Solicitar redefinição de senha
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email é obrigatório', 400, 'MISSING_EMAIL');
  }

  // Solicitar reset de senha
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.FRONTEND_URL}/reset-password`
  });

  if (error) {
    throw new AppError('Erro ao enviar email: ' + error.message, 500, 'EMAIL_ERROR');
  }

  res.json({
    message: 'Email de redefinição enviado com sucesso'
  });
}));

module.exports = router;