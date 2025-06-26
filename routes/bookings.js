const express = require('express');
const { supabase } = require('../config/supabase');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { authorize } = require('../middleware/auth');
const BookingNumberGenerator = require('../utils/bookingNumberGenerator');

const router = express.Router();

/**
 * GET /api/bookings
 * Listar reservas do usuário (ou todas para admins)
 */
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    event_id,
    start_date,
    end_date,
    sort_by = 'booked_at',
    sort_order = 'desc'
  } = req.query;

  const offset = (page - 1) * limit;

  // Construir query base
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
        price,
        currency,
        venues (
          id,
          name,
          city,
          state
        )
      )
    `, { count: 'exact' })
    .is('deleted_at', null);

  // Filtrar por usuário (exceto para admins)
  if (req.user.role !== 'admin') {
    query = query.eq('user_id', req.user.id);
  }

  // Aplicar filtros
  if (status) {
    query = query.eq('status', status);
  }
  
  if (event_id) {
    query = query.eq('event_id', event_id);
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

/**
 * GET /api/bookings/:id
 * Buscar reserva específica
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

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
        price,
        currency,
        venues (
          id,
          name,
          address,
          city,
          state,
          country
        )
      ),
      users (
        id,
        first_name,
        last_name,
        email
      )
    `)
    .eq('id', id)
    .is('deleted_at', null);

  // Filtrar por usuário (exceto para admins)
  if (req.user.role !== 'admin') {
    query = query.eq('user_id', req.user.id);
  }

  const { data: booking, error } = await query.single();

  if (error || !booking) {
    throw new AppError('Reserva não encontrada', 404, 'BOOKING_NOT_FOUND');
  }

  res.json({ booking });
}));

/**
 * POST /api/bookings
 * Criar nova reserva
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    event_id,
    quantity,
    seat_numbers = [],
    customer_notes,
    user_id
  } = req.body;

  // Validações básicas
  if (!event_id || !quantity || quantity <= 0) {
    throw new AppError('Dados de reserva inválidos', 400, 'INVALID_BOOKING_DATA');
  }

  if (quantity > 10) {
    throw new AppError('Máximo de 10 ingressos por reserva', 400, 'QUANTITY_LIMIT_EXCEEDED');
  }

  // Buscar evento
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(`
      *,
      venues (id, name, capacity)
    `)
    .eq('id', event_id)
    .eq('is_active', true)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single();

  if (eventError || !event) {
    throw new AppError('Evento não encontrado ou não disponível', 404, 'EVENT_NOT_AVAILABLE');
  }

  // Verificar se evento já começou
  const now = new Date();
  const eventStart = new Date(event.start_date_time);
  
  if (eventStart <= now) {
    throw new AppError('Não é possível reservar ingressos para eventos que já começaram', 400, 'EVENT_STARTED');
  }

  // Verificar limite de ingressos por usuário
  if (quantity > event.max_tickets_per_user) {
    throw new AppError(`Máximo de ${event.max_tickets_per_user} ingressos por usuário para este evento`, 400, 'USER_LIMIT_EXCEEDED');
  }

  // Verificar reservas existentes do usuário para este evento
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('quantity')
    .eq('user_id', user_id)
    .eq('event_id', event_id)
    .in('status', ['pending', 'confirmed'])
    .is('deleted_at', null);

  const totalUserTickets = existingBookings?.reduce((sum, booking) => sum + booking.quantity, 0) || 0;
  
  if (totalUserTickets + quantity > event.max_tickets_per_user) {
    throw new AppError(`Você já tem ${totalUserTickets} ingressos. Máximo permitido: ${event.max_tickets_per_user}`, 400, 'USER_LIMIT_EXCEEDED');
  }

  // Verificar disponibilidade
  if (event.available_tickets < quantity) {
    throw new AppError('Ingressos insuficientes disponíveis', 400, 'INSUFFICIENT_TICKETS');
  }

  // Validar assentos se especificados
  if (seat_numbers.length > 0) {
    if (seat_numbers.length !== quantity) {
      throw new AppError('Número de assentos deve corresponder à quantidade', 400, 'SEAT_QUANTITY_MISMATCH');
    }

    // Verificar se assentos estão disponíveis
    const { data: occupiedSeats } = await supabase
      .from('bookings')
      .select('seat_numbers')
      .eq('event_id', event_id)
      .in('status', ['pending', 'confirmed'])
      .is('deleted_at', null)
      .neq('seat_numbers', '[]');

    const allOccupiedSeats = [];
    occupiedSeats?.forEach(booking => {
      if (booking.seat_numbers && Array.isArray(booking.seat_numbers)) {
        allOccupiedSeats.push(...booking.seat_numbers);
      }
    });

    const conflictingSeats = seat_numbers.filter(seat => allOccupiedSeats.includes(seat));
    if (conflictingSeats.length > 0) {
      throw new AppError(`Assentos já ocupados: ${conflictingSeats.join(', ')}`, 400, 'SEATS_OCCUPIED');
    }
  }

  // Calcular total
  const totalAmount = quantity * parseFloat(event.price);

  // Usar função SQL para gerar booking number único
  // const { data: bookingNumberResult, error: bookingNumberError } = await supabase
  //   .rpc('generate_booking_number');

  // if (bookingNumberError) {
  //   throw new AppError('Erro ao gerar número da reserva', 500, 'BOOKING_NUMBER_ERROR');
  // }

  let bookingNumber;
    try {
      bookingNumber = await BookingNumberGenerator.generateBookingNumber();
    } catch (error) {
      console.error('Erro ao gerar booking number:', error);
      // Fallback para timestamp
      bookingNumber = BookingNumberGenerator.generateTimestampBookingNumber();
    }


  // Criar reserva
  const bookingData = {
    booking_number: bookingNumber,
    user_id: user_id,
    event_id,
    quantity,
    total_amount: totalAmount,
    currency: event.currency,
    seat_numbers: seat_numbers.length > 0 ? seat_numbers : [],
    customer_notes,
    status: 'pending',
    payment_status: 'pending',
    client_ip: req.ip,
    user_agent: req.get('User-Agent')
  };

  // Transação para criar reserva e atualizar disponibilidade
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert(bookingData)
    .select(`
      *,
      events (
        id,
        title,
        start_date_time,
        venues (name, address, city)
      )
    `)
    .single();

  if (bookingError) {
    throw new AppError('Erro ao criar reserva: ' + bookingError.message, 500, 'CREATE_ERROR');
  }

  // Atualizar ingressos disponíveis
  const { error: updateError } = await supabase
    .from('events')
    .update({ 
      available_tickets: event.available_tickets - quantity 
    })
    .eq('id', event_id);

  if (updateError) {
    // Reverter reserva se falhar ao atualizar disponibilidade
    await supabase
      .from('bookings')
      .delete()
      .eq('id', booking.id);
    
    throw new AppError('Erro ao atualizar disponibilidade', 500, 'UPDATE_ERROR');
  }

  res.status(201).json({
    message: 'Reserva criada com sucesso',
    booking
  });
}));

/**
 * PUT /api/bookings/:id/confirm
 * Confirmar reserva (simular pagamento)
 */
router.put('/:id/confirm', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { payment_method, payment_reference } = req.body;

  // Buscar reserva
  let query = supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .eq('status', 'pending')
    .is('deleted_at', null);

  // Filtrar por usuário (exceto para admins)
  if (req.user.role !== 'admin') {
    query = query.eq('user_id', req.user.id);
  }

  const { data: booking, error: fetchError } = await query.single();

  if (fetchError || !booking) {
    throw new AppError('Reserva não encontrada ou não está pendente', 404, 'BOOKING_NOT_FOUND');
  }

  // Atualizar reserva
  const { data: updatedBooking, error } = await supabase
    .from('bookings')
    .update({
      status: 'confirmed',
      payment_status: 'paid',
      payment_method,
      payment_reference,
      confirmed_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      events (
        id,
        title,
        start_date_time,
        venues (name, address, city)
      )
    `)
    .single();

  if (error) {
    throw new AppError('Erro ao confirmar reserva: ' + error.message, 500, 'CONFIRM_ERROR');
  }

  res.json({
    message: 'Reserva confirmada com sucesso',
    booking: updatedBooking
  });
}));

/**
 * PUT /api/bookings/:id/cancel
 * Cancelar reserva
 */
router.put('/:id/cancel', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  // Buscar reserva
  let query = supabase
    .from('bookings')
    .select(`
      *,
      events (id, start_date_time, available_tickets)
    `)
    .eq('id', id)
    .in('status', ['pending', 'confirmed'])
    .is('deleted_at', null);

  // Filtrar por usuário (exceto para admins)
  if (req.user.role !== 'admin') {
    query = query.eq('user_id', req.user.id);
  }

  const { data: booking, error: fetchError } = await query.single();

  if (fetchError || !booking) {
    throw new AppError('Reserva não encontrada ou não pode ser cancelada', 404, 'BOOKING_NOT_FOUND');
  }

  // Verificar se evento já começou
  const now = new Date();
  const eventStart = new Date(booking.events.start_date_time);
  
  if (eventStart <= now) {
    throw new AppError('Não é possível cancelar reservas de eventos que já começaram', 400, 'EVENT_STARTED');
  }

  // Cancelar reserva
  const { data: cancelledBooking, error } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      admin_notes: reason ? `Cancelado: ${reason}` : 'Cancelado pelo usuário'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('Erro ao cancelar reserva: ' + error.message, 500, 'CANCEL_ERROR');
  }

  // Restaurar ingressos disponíveis
  const { error: updateError } = await supabase
    .from('events')
    .update({ 
      available_tickets: booking.events.available_tickets + booking.quantity 
    })
    .eq('id', booking.event_id);

  if (updateError) {
    console.error('Erro ao restaurar ingressos:', updateError);
    // Não falhar a operação, mas logar o erro
  }

  res.json({
    message: 'Reserva cancelada com sucesso',
    booking: cancelledBooking
  });
}));

module.exports = router;