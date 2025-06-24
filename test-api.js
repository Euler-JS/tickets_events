/**
 * Script para testar as APIs do sistema de bilhetagem
 * Execute: node test-api.js
 */

const API_BASE = 'http://localhost:3000/api';

// Função auxiliar para fazer requests
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    console.log(`${config.method || 'GET'} ${endpoint}`);
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log('---');
    
    return { response, data };
  } catch (error) {
    console.error(`Erro em ${endpoint}:`, error.message);
    return { error };
  }
}

// Dados de teste
const testUser = {
  firstName: 'João',
  lastName: 'Silva',
  email: 'joao.silva@teste.com',
  password: 'MinhaSenh@123',
  phone: '+258840000000',
  dateOfBirth: '1990-01-01'
};

const testVenue = {
  name: 'Teatro Municipal',
  type: 'theater',
  description: 'Teatro histórico no centro da cidade',
  address: 'Avenida Principal, 100',
  city: 'Maputo',
  state: 'Maputo',
  country: 'Moçambique',
  capacity: 500,
  latitude: -25.9692,
  longitude: 32.5732,
  amenities: ['estacionamento', 'ar_condicionado', 'wifi'],
  contact_info: {
    phone: '+258210000000',
    email: 'contato@teatromunicipal.co.mz'
  }
};

const testEvent = {
  title: 'Peça de Teatro: Romeu e Julieta',
  description: 'Clássico de Shakespeare em nova interpretação',
  type: 'theater',
  category: 'Drama',
  start_date_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias no futuro
  end_date_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // 2h depois
  age_rating: '12+',
  language: 'Português',
  price: 150.00,
  currency: 'MZN',
  available_tickets: 300,
  max_tickets_per_user: 4
};

// Script principal
async function runTests() {
  console.log('🚀 Iniciando testes da API...\n');
  
  let authToken = '';
  let venueId = '';
  let eventId = '';
  
  // 1. Health Check
  console.log('1. Health Check');
  await apiRequest('/health');
  
  // 2. Registrar usuário
  console.log('2. Registrar usuário');
  const registerResult = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(testUser)
  });
  
  if (registerResult.data?.user) {
    console.log('✅ Usuário registrado com sucesso');
  }
  
  // 3. Fazer login
  console.log('3. Fazer login');
  const loginResult = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: testUser.email,
      password: testUser.password
    })
  });
  
  if (loginResult.data?.session?.access_token) {
    authToken = loginResult.data.session.access_token;
    console.log('✅ Login realizado com sucesso');
  } else {
    console.log('❌ Falha no login');
    return;
  }
  
  // Headers com autenticação
  const authHeaders = {
    'Authorization': `Bearer ${authToken}`
  };
  
  // 4. Buscar perfil
  console.log('4. Buscar perfil do usuário');
  await apiRequest('/users/profile', {
    headers: authHeaders
  });
  
  // 5. Listar venues
  console.log('5. Listar venues');
  await apiRequest('/venues', {
    headers: authHeaders
  });
  
  // 6. Criar venue (como admin - vai falhar se user não for admin)
  console.log('6. Tentar criar venue (deve falhar - usuário não é admin)');
  await apiRequest('/venues', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(testVenue)
  });
  
  // 7. Listar eventos
  console.log('7. Listar eventos');
  const eventsResult = await apiRequest('/events', {
    headers: authHeaders
  });
  
  // 8. Criar reserva (se houver eventos)
  if (eventsResult.data?.events?.length > 0) {
    const firstEvent = eventsResult.data.events[0];
    console.log('8. Criar reserva para primeiro evento');
    
    await apiRequest('/bookings', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        event_id: firstEvent.id,
        quantity: 2,
        customer_notes: 'Reserva de teste'
      })
    });
  } else {
    console.log('8. Pular criação de reserva - nenhum evento disponível');
  }
  
  // 9. Listar reservas do usuário
  console.log('9. Listar reservas do usuário');
  await apiRequest('/bookings', {
    headers: authHeaders
  });
  
  // 10. Atualizar perfil
  console.log('10. Atualizar perfil');
  await apiRequest('/users/profile', {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      phone: '+258841111111',
      preferences: {
        newsletter: true,
        notifications: true
      }
    })
  });
  
  // 11. Fazer logout
  console.log('11. Fazer logout');
  await apiRequest('/auth/logout', {
    method: 'POST',
    headers: authHeaders
  });
  
  console.log('🎉 Testes concluídos!');
}

// Executar testes
runTests().catch(console.error);