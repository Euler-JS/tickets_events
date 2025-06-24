/**
 * Script para popular o banco com dados iniciais
 * Execute: node utils/seedData.js
 */

require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase'); // CORRIGIDO: sem src/
const bcrypt = require('bcryptjs');

// Dados de exemplo
const seedUsers = [
  {
    first_name: 'Admin',
    last_name: 'Sistema',
    email: 'admin@ticketing.co.mz',
    password: 'Admin@007',
    role: 'admin',
    phone: '+258840000001'
  },
  {
    first_name: 'Maria',
    last_name: 'Fernandes',
    email: 'maria.venue@ticketing.co.mz',
    password: 'Manager@123',
    role: 'venue_manager',
    phone: '+258840000002'
  },
  {
    first_name: 'João',
    last_name: 'Cliente',
    email: 'joao.cliente@email.com',
    password: 'Cliente@123',
    role: 'customer',
    phone: '+258840000003',
    date_of_birth: '1985-05-15'
  },
  {
    first_name: 'Ana',
    last_name: 'Santos',
    email: 'ana.santos@email.com',
    password: 'Cliente@123',
    role: 'customer',
    phone: '+258840000004',
    date_of_birth: '1992-08-22'
  }
];

const seedVenues = [
  {
    name: 'Teatro Avenida',
    type: 'theater',
    description: 'Teatro histórico no centro de Maputo com excelente acústica',
    address: 'Avenida 25 de Setembro, 1234',
    city: 'Maputo',
    state: 'Maputo',
    country: 'Moçambique',
    postal_code: '1100',
    latitude: -25.9692,
    longitude: 32.5732,
    capacity: 800,
    amenities: ['estacionamento', 'ar_condicionado', 'wifi', 'bar', 'acessibilidade'],
    contact_info: {
      phone: '+258210000001',
      email: 'info@teatroavenida.co.mz',
      website: 'https://teatroavenida.co.mz'
    }
  },
  {
    name: 'Estádio Nacional',
    type: 'stadium',
    description: 'Principal estádio do país para eventos esportivos e shows',
    address: 'Avenida da Marginal, 500',
    city: 'Maputo',
    state: 'Maputo',
    country: 'Moçambique',
    postal_code: '1101',
    latitude: -25.9508,
    longitude: 32.6069,
    capacity: 42000,
    amenities: ['estacionamento', 'seguranca', 'lanchonete', 'lojas'],
    contact_info: {
      phone: '+258210000002',
      email: 'eventos@estadionacional.co.mz'
    }
  },
  {
    name: 'Cinema Scala',
    type: 'cinema',
    description: 'Moderno complexo de cinema com múltiplas salas',
    address: 'Shopping Maputo, Piso 2',
    city: 'Maputo',
    state: 'Maputo',
    country: 'Moçambique',
    postal_code: '1102',
    latitude: -25.9636,
    longitude: 32.5816,
    capacity: 300,
    amenities: ['ar_condicionado', 'wifi', 'lanchonete', 'estacionamento'],
    contact_info: {
      phone: '+258210000003',
      email: 'info@cinemascala.co.mz'
    }
  },
  {
    name: 'Arena Polana',
    type: 'arena',
    description: 'Arena moderna para shows e eventos esportivos',
    address: 'Bairro da Polana, Rua 1',
    city: 'Maputo',
    state: 'Maputo',
    country: 'Moçambique',
    postal_code: '1103',
    latitude: -25.9553,
    longitude: 32.5892,
    capacity: 15000,
    amenities: ['estacionamento', 'seguranca', 'bar', 'vip_area'],
    contact_info: {
      phone: '+258210000004',
      email: 'eventos@arenapolana.co.mz'
    }
  }
];

const seedEvents = [
  {
    title: 'Concerto de Marrabenta Clássica',
    description: 'Uma noite especial com os grandes sucessos da marrabenta moçambicana',
    type: 'concert',
    category: 'Música Tradicional',
    start_date_time: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 dias
    end_date_time: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(), // 3h depois
    age_rating: 'Livre',
    language: 'Português',
    poster_url: 'https://example.com/poster1.jpg',
    price: 250.00,
    currency: 'MZN',
    available_tickets: 700,
    max_tickets_per_user: 6,
    status: 'published'
  },
  {
    title: 'Final do Campeonato Nacional',
    description: 'Grande final entre os dois melhores times do país',
    type: 'sports',
    category: 'Futebol',
    start_date_time: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 dias
    end_date_time: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // 2h depois
    age_rating: 'Livre',
    language: 'Português',
    poster_url: 'https://example.com/poster2.jpg',
    price: 150.00,
    currency: 'MZN',
    available_tickets: 40000,
    max_tickets_per_user: 8,
    status: 'published'
  },
  {
    title: 'Estreia: Filme Moçambicano',
    description: 'Estreia nacional do mais recente filme produzido em Moçambique',
    type: 'movie',
    category: 'Drama',
    start_date_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
    end_date_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // 2h depois
    age_rating: '14+',
    language: 'Português',
    subtitles: ['Inglês'],
    poster_url: 'https://example.com/poster3.jpg',
    trailer_url: 'https://example.com/trailer3.mp4',
    price: 80.00,
    currency: 'MZN',
    available_tickets: 250,
    max_tickets_per_user: 4,
    status: 'published'
  },
  {
    title: 'Show Internacional - Artista Africano',
    description: 'Show imperdível com artista premiado internacionalmente',
    type: 'concert',
    category: 'Música Internacional',
    start_date_time: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 dias
    end_date_time: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(), // 4h depois
    age_rating: '16+',
    language: 'Inglês',
    poster_url: 'https://example.com/poster4.jpg',
    price: 500.00,
    currency: 'MZN',
    available_tickets: 12000,
    max_tickets_per_user: 10,
    status: 'published'
  }
];

async function createUsersWithAuth() {
  console.log('🔐 Criando usuários com autenticação...');
  const createdUsers = [];

  for (const userData of seedUsers) {
    try {
      // Criar usuário no Supabase Auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true
      });

      if (authError) {
        console.error(`Erro ao criar usuário ${userData.email}:`, authError.message);
        continue;
      }

      // Hash da senha para nossa tabela
      const passwordHash = await bcrypt.hash(userData.password, 12);

      // Criar registro na nossa tabela
      const { data: dbUser, error: dbError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authUser.user.id,
          first_name: userData.first_name,
          last_name: userData.last_name,
          email: userData.email,
          password_hash: passwordHash,
          phone: userData.phone,
          date_of_birth: userData.date_of_birth,
          role: userData.role,
          is_active: true
        })
        .select()
        .single();

      if (dbError) {
        console.error(`Erro ao criar perfil ${userData.email}:`, dbError.message);
        // Limpar usuário do Auth se falhar
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        continue;
      }

      createdUsers.push(dbUser);
      console.log(`✅ Usuário criado: ${userData.email} (${userData.role})`);
      
    } catch (error) {
      console.error(`Erro geral para ${userData.email}:`, error.message);
    }
  }

  return createdUsers;
}

async function createVenues(users) {
  console.log('\n🏢 Criando venues...');
  const createdVenues = [];
  
  // Encontrar venue manager
  const venueManager = users.find(u => u.role === 'venue_manager');

  for (let i = 0; i < seedVenues.length; i++) {
    const venueData = {
      ...seedVenues[i],
      manager_id: i < 2 ? venueManager?.id : null // Primeiros 2 venues com manager
    };

    try {
      const { data: venue, error } = await supabaseAdmin
        .from('venues')
        .insert(venueData)
        .select()
        .single();

      if (error) {
        console.error(`Erro ao criar venue ${venueData.name}:`, error.message);
        continue;
      }

      createdVenues.push(venue);
      console.log(`✅ Venue criado: ${venue.name}`);
      
    } catch (error) {
      console.error(`Erro geral para venue ${venueData.name}:`, error.message);
    }
  }

  return createdVenues;
}

async function createEvents(venues) {
  console.log('\n🎭 Criando eventos...');
  const createdEvents = [];

  for (let i = 0; i < seedEvents.length; i++) {
    const eventData = {
      ...seedEvents[i],
      venue_id: venues[i % venues.length]?.id // Distribuir entre venues
    };

    if (!eventData.venue_id) {
      console.log(`⚠️ Pulando evento ${eventData.title} - sem venue disponível`);
      continue;
    }

    try {
      const { data: event, error } = await supabaseAdmin
        .from('events')
        .insert(eventData)
        .select()
        .single();

      if (error) {
        console.error(`Erro ao criar evento ${eventData.title}:`, error.message);
        continue;
      }

      createdEvents.push(event);
      console.log(`✅ Evento criado: ${event.title}`);
      
    } catch (error) {
      console.error(`Erro geral para evento ${eventData.title}:`, error.message);
    }
  }

  return createdEvents;
}

async function createSampleBookings(users, events) {
  console.log('\n🎫 Criando reservas de exemplo...');
  
  const customers = users.filter(u => u.role === 'customer');
  if (customers.length === 0 || events.length === 0) {
    console.log('⚠️ Sem clientes ou eventos para criar reservas');
    return;
  }

  const sampleBookings = [
    {
      user_id: customers[0].id,
      event_id: events[0]?.id,
      quantity: 2,
      customer_notes: 'Reserva de exemplo - assentos preferenciais'
    },
    {
      user_id: customers[1]?.id || customers[0].id,
      event_id: events[1]?.id || events[0]?.id,
      quantity: 4,
      customer_notes: 'Reserva família'
    }
  ];

  for (const bookingData of sampleBookings) {
    if (!bookingData.event_id || !bookingData.user_id) continue;

    try {
      // Buscar preço do evento
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('price, currency')
        .eq('id', bookingData.event_id)
        .single();

      if (!event) continue;

      // Gerar booking number
      const { data: bookingNumber } = await supabaseAdmin
        .rpc('generate_booking_number');

      const fullBookingData = {
        ...bookingData,
        booking_number: bookingNumber,
        total_amount: bookingData.quantity * parseFloat(event.price),
        currency: event.currency,
        status: 'confirmed',
        payment_status: 'paid',
        payment_method: 'example',
        confirmed_at: new Date().toISOString()
      };

      const { data: booking, error } = await supabaseAdmin
        .from('bookings')
        .insert(fullBookingData)
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar reserva:', error.message);
        continue;
      }

      // Atualizar tickets disponíveis
      await supabaseAdmin
        .from('events')
        .update({ 
          available_tickets: supabaseAdmin.sql`available_tickets - ${bookingData.quantity}`
        })
        .eq('id', bookingData.event_id);

      console.log(`✅ Reserva criada: ${booking.booking_number}`);
      
    } catch (error) {
      console.error('Erro geral ao criar reserva:', error.message);
    }
  }
}

async function seedDatabase() {
  console.log('🌱 Iniciando seed do banco de dados...\n');

  try {
    // 1. Criar usuários
    const users = await createUsersWithAuth();
    
    // 2. Criar venues
    const venues = await createVenues(users);
    
    // 3. Criar eventos
    const events = await createEvents(venues);
    
    // 4. Criar algumas reservas de exemplo
    await createSampleBookings(users, events);

    console.log('\n🎉 Seed concluído com sucesso!');
    console.log('\nCredenciais de teste:');
    console.log('Admin: admin@ticketing.co.mz / Admin@123');
    console.log('Venue Manager: maria.venue@ticketing.co.mz / Manager@123');
    console.log('Cliente: joao.cliente@email.com / Cliente@123');
    console.log('Cliente: ana.santos@email.com / Cliente@123');
    
  } catch (error) {
    console.error('❌ Erro durante o seed:', error.message);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  seedDatabase().then(() => process.exit(0));
}

module.exports = { seedDatabase };