# Sistema de Bilhetagem - API Node.js

Sistema completo de bilhetagem para eventos com Node.js e Supabase, oferecendo funcionalidades para gestão de eventos, venues, reservas e usuários.

## 🚀 Funcionalidades

- **Autenticação**: Registro, login, logout e gestão de sessões
- **Gestão de Usuários**: Perfis, papéis (customer, venue_manager, admin)
- **Venues**: Cadastro e gestão de locais para eventos
- **Eventos**: Criação, edição e gestão de eventos
- **Reservas**: Sistema completo de bookings com validação de assentos
- **Segurança**: Rate limiting, validação de dados, audit trail
- **Permissões**: Row Level Security (RLS) integrado com Supabase

## 📋 Pré-requisitos

- Node.js (versão 16 ou superior)
- Conta no Supabase
- Git

## 🛠️ Instalação

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd ticketing-system
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações do Supabase:

```env
# Supabase Configuration
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration
JWT_SECRET=sua_chave_secreta_muito_segura_aqui
JWT_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

### 4. Execute o script SQL no Supabase
Execute o script SQL fornecido (`paste.txt`) no SQL Editor do seu projeto Supabase para criar todas as tabelas, funções e triggers necessários.

### 5. Inicie o servidor
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

O servidor estará disponível em `http://localhost:3000`

## 📁 Estrutura do Projeto

```
 
├── config/
│   └── supabase.js          # Configuração do cliente Supabase
├── middleware/
│   ├── auth.js              # Middleware de autenticação
│   └── errorHandler.js      # Tratamento global de erros
├── routes/
│   ├── auth.js              # Rotas de autenticação
│   ├── events.js            # Rotas de eventos
│   ├── bookings.js          # Rotas de reservas
│   ├── venues.js            # Rotas de venues
│   └── users.js             # Rotas de usuários
├── validators/
│   └── auth.js              # Validadores de entrada
└── server.js                 # Servidor principal
```

## 🔑 Autenticação

### Registro de Usuário
```javascript
POST /api/auth/register
{
  "firstName": "João",
  "lastName": "Silva",
  "email": "joao@email.com",
  "password": "MinhaSenh@123",
  "phone": "+258840000000",
  "dateOfBirth": "1990-01-01"
}
```

### Login
```javascript
POST /api/auth/login
{
  "email": "joao@email.com",
  "password": "MinhaSenh@123"
}
```

### Uso do Token
Todas as rotas protegidas requerem o header de autorização:
```
Authorization: Bearer <access_token>
```

## 📚 Endpoints da API

### Autenticação (`/api/auth`)
- `POST /register` - Registrar novo usuário
- `POST /login` - Fazer login
- `POST /logout` - Fazer logout
- `POST /refresh` - Renovar token
- `POST /forgot-password` - Solicitar redefinição de senha

### Usuários (`/api/users`)
- `GET /profile` - Buscar perfil próprio
- `PUT /profile` - Atualizar perfil próprio
- `PUT /change-password` - Alterar senha
- `GET /` - Listar usuários (admin)
- `GET /:id` - Buscar usuário específico (admin)
- `PUT /:id` - Atualizar usuário (admin)
- `DELETE /:id` - Deletar usuário (admin)
- `GET /:id/bookings` - Reservas do usuário

### Venues (`/api/venues`)
- `GET /` - Listar venues
- `GET /:id` - Buscar venue específico
- `POST /` - Criar venue (admin)
- `PUT /:id` - Atualizar venue (venue_manager/admin)
- `DELETE /:id` - Deletar venue (admin)
- `GET /:id/events` - Eventos do venue

### Eventos (`/api/events`)
- `GET /` - Listar eventos (com filtros)
- `GET /:id` - Buscar evento específico
- `POST /` - Criar evento (venue_manager/admin)
- `PUT /:id` - Atualizar evento (venue_manager/admin)
- `DELETE /:id` - Deletar evento (venue_manager/admin)

### Reservas (`/api/bookings`)
- `GET /` - Listar reservas próprias
- `GET /:id` - Buscar reserva específica
- `POST /` - Criar nova reserva
- `PUT /:id/confirm` - Confirmar reserva (pagamento)
- `PUT /:id/cancel` - Cancelar reserva

## 🎯 Exemplos de Uso

### Criar um Evento
```javascript
POST /api/events
Authorization: Bearer <token>
{
  "title": "Show da Banda XYZ",
  "description": "Apresentação ao vivo da famosa banda",
  "type": "concert",
  "start_date_time": "2024-12-25T20:00:00Z",
  "end_date_time": "2024-12-25T23:00:00Z",
  "price": 50.00,
  "currency": "MZN",
  "available_tickets": 500,
  "venue_id": "uuid-do-venue"
}
```

### Fazer uma Reserva
```javascript
POST /api/bookings
Authorization: Bearer <token>
{
  "event_id": "uuid-do-evento",
  "quantity": 2,
  "seat_numbers": ["A1", "A2"],
  "customer_notes": "Assentos preferenciais"
}
```

### Filtrar Eventos
```javascript
GET /api/events?type=concert&city=Maputo&start_date=2024-12-01&limit=20
```

## 🔒 Segurança

### Rate Limiting
- 100 requests por 15 minutos por IP
- Configurável via variáveis de ambiente

### Validação de Dados
- Validação rigorosa usando Joi
- Sanitização de entrada
- Verificação de tipos e formatos

### Row Level Security (RLS)
- Políticas de acesso ao nível de linha
- Usuários só veem seus próprios dados
- Venue managers só gerenciam seus venues
- Admins têm acesso completo

## 🗃️ Papéis de Usuário

### Customer (cliente)
- Visualizar eventos públicos
- Criar e gerenciar suas reservas
- Atualizar próprio perfil

### Venue Manager (gerente de venue)
- Gerenciar seus venues
- Criar e gerenciar eventos em seus venues
- Visualizar reservas dos seus eventos

### Admin (administrador)
- Acesso completo a todos os recursos
- Gerenciar usuários
- Criar e gerenciar venues
- Acesso a audit logs

## 🧪 Testando a API

Execute o script de teste fornecido:
```bash
node test-api.js
```

Ou use ferramentas como Postman, Insomnia ou curl para testar manualmente os endpoints.

## 📊 Monitoramento

### Health Check
```javascript
GET /health
```

Retorna status do servidor e informações básicas.

### Audit Trail
Todas as operações são automaticamente logadas na tabela `audit_log` para rastreabilidade.

## 🚀 Deploy

### Preparação para Produção
1. Configure variáveis de ambiente adequadas
2. Use HTTPS
3. Configure CORS apropriadamente
4. Ajuste rate limits conforme necessário
5. Configure logs estruturados

### Variáveis de Ambiente de Produção
```env
NODE_ENV=production
PORT=8080
CORS_ORIGIN=https://seu-frontend.com
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para detalhes.

## 🆘 Suporte

Para suporte e dúvidas:
- Abra uma issue no repositório
- Consulte a documentação do Supabase
- Verifique os logs de erro para debug

## 🔄 Próximos Passos

- [ ] Implementar sistema de notificações
- [ ] Adicionar upload de imagens
- [ ] Integração com gateway de pagamento
- [ ] Sistema de cupons e descontos
- [ ] Analytics e relatórios
- [ ] API de webhooks
- [ ] Testes automatizados