-- ===================================
-- SCRIPT AJUSTADO PARA SUPABASE
-- ===================================

-- MIGRATION 001: EXTENSÕES E SCHEMA INICIAL
BEGIN;

-- Criar extensões necessárias (ajustado para Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- PostGIS removido - não disponível por padrão no Supabase
-- Se precisar de funcionalidades geográficas, use POINT simples ou coordenadas

-- Criar enums
CREATE TYPE user_role AS ENUM ('customer', 'admin', 'venue_manager');
CREATE TYPE venue_type AS ENUM ('cinema', 'stadium', 'theater', 'arena', 'conference_hall', 'other');
CREATE TYPE event_type AS ENUM ('movie', 'concert', 'sports', 'theater', 'conference', 'other');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'refunded', 'completed');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- Tabela Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(50) NOT NULL CHECK (length(trim(first_name)) >= 2),
    last_name VARCHAR(50) NOT NULL CHECK (length(trim(last_name)) >= 2),
    email VARCHAR(255) NOT NULL UNIQUE CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20) CHECK (phone ~ '^\+?[1-9]\d{1,14}$'),
    date_of_birth DATE CHECK (date_of_birth < CURRENT_DATE),
    role user_role NOT NULL DEFAULT 'customer',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    email_verified_at TIMESTAMPTZ,
    profile_picture_url TEXT,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Tabela Venues (sem PostGIS - usando coordenadas simples)
CREATE TABLE venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL CHECK (length(trim(name)) >= 2),
    type venue_type NOT NULL,
    description TEXT,
    address TEXT NOT NULL CHECK (length(trim(address)) >= 5),
    city VARCHAR(100) NOT NULL CHECK (length(trim(city)) >= 2),
    state VARCHAR(100) NOT NULL CHECK (length(trim(state)) >= 2),
    country VARCHAR(100) NOT NULL CHECK (length(trim(country)) >= 2),
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8), -- Latitude simples
    longitude DECIMAL(11, 8), -- Longitude simples
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    amenities JSONB DEFAULT '[]',
    contact_info JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Tabela Events
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL CHECK (length(trim(title)) >= 2),
    description TEXT,
    type event_type NOT NULL,
    category VARCHAR(100),
    start_date_time TIMESTAMPTZ NOT NULL,
    end_date_time TIMESTAMPTZ NOT NULL CHECK (end_date_time > start_date_time),
    duration_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (end_date_time - start_date_time)) / 60
    ) STORED,
    age_rating VARCHAR(10),
    language VARCHAR(50),
    subtitles JSONB DEFAULT '[]',
    poster_url TEXT CHECK (poster_url ~ '^https?://'),
    trailer_url TEXT CHECK (trailer_url ~ '^https?://'),
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    available_tickets INTEGER NOT NULL CHECK (available_tickets >= 0),
    max_tickets_per_user INTEGER NOT NULL DEFAULT 10 CHECK (max_tickets_per_user > 0),
    status event_status NOT NULL DEFAULT 'draft',
    is_active BOOLEAN NOT NULL DEFAULT true,
    venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_event_timing CHECK (start_date_time > NOW())
);

-- Tabela Bookings
CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_number VARCHAR(50) NOT NULL UNIQUE,
    quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 10),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status booking_status NOT NULL DEFAULT 'pending',
    payment_status payment_status NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    seat_numbers JSONB DEFAULT '[]',
    customer_notes TEXT,
    admin_notes TEXT,
    booked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    client_ip INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_status_timestamps CHECK (
        (status != 'confirmed' OR confirmed_at IS NOT NULL) AND
        (status != 'cancelled' OR cancelled_at IS NOT NULL)
    ),
    CONSTRAINT valid_seat_quantity CHECK (
        seat_numbers = '[]'::jsonb OR 
        jsonb_array_length(seat_numbers) = quantity
    )
);

-- Tabela Audit Trail
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    user_id UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

-- ===================================
-- MIGRATION 002: ÍNDICES PARA PERFORMANCE
-- ===================================

BEGIN;

-- Índices para Users
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_active ON users(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_last_login ON users(last_login_at DESC);

-- Índices para Venues
CREATE INDEX idx_venues_type ON venues(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_city ON venues(city) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_active ON venues(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_venues_manager ON venues(manager_id) WHERE deleted_at IS NULL;
-- Índice para coordenadas (sem PostGIS)
CREATE INDEX idx_venues_coordinates ON venues(latitude, longitude) WHERE deleted_at IS NULL;

-- Índices para Events
CREATE INDEX idx_events_venue ON events(venue_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_type ON events(type) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_status ON events(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_start_time ON events(start_date_time) WHERE deleted_at IS NULL;
CREATE INDEX idx_events_active_published ON events(is_active, status) 
    WHERE deleted_at IS NULL AND is_active = true AND status = 'published';
CREATE INDEX idx_events_available_tickets ON events(available_tickets) 
    WHERE deleted_at IS NULL AND available_tickets > 0;
CREATE INDEX idx_events_search ON events USING GIN(to_tsvector('portuguese', title || ' ' || COALESCE(description, '')));

-- Índices para Bookings
CREATE INDEX idx_bookings_user ON bookings(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_event ON bookings(event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_status ON bookings(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_payment_status ON bookings(payment_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_booking_number ON bookings(booking_number);
CREATE INDEX idx_bookings_user_event ON bookings(user_id, event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_booked_at ON bookings(booked_at DESC);
CREATE INDEX idx_bookings_pending ON bookings(status, booked_at) 
    WHERE status = 'pending' AND deleted_at IS NULL;

-- Índices para Audit Log
CREATE INDEX idx_audit_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_operation ON audit_log(operation);

-- Índices compostos para queries complexas
CREATE INDEX idx_events_venue_datetime ON events(venue_id, start_date_time) 
    WHERE deleted_at IS NULL;
CREATE INDEX idx_bookings_event_seats ON bookings(event_id) 
    WHERE seat_numbers != '[]'::jsonb AND deleted_at IS NULL;

COMMIT;

-- ===================================
-- MIGRATION 003: FUNÇÕES AUXILIARES
-- ===================================

BEGIN;

-- Função para gerar booking number único
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
DECLARE
    prefix TEXT := 'BK';
    timestamp_part TEXT;
    random_part TEXT;
    booking_number TEXT;
    counter INTEGER := 0;
BEGIN
    timestamp_part := TO_CHAR(NOW(), 'YYYYMMDDHH24MI');
    
    LOOP
        random_part := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
        booking_number := prefix || '-' || timestamp_part || '-' || random_part;
        
        -- Verificar se já existe
        IF NOT EXISTS (SELECT 1 FROM bookings WHERE booking_number = booking_number) THEN
            RETURN booking_number;
        END IF;
        
        counter := counter + 1;
        IF counter > 10 THEN
            RAISE EXCEPTION 'Não foi possível gerar booking number único após 10 tentativas';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para validar disponibilidade de assentos
CREATE OR REPLACE FUNCTION validate_seat_availability(
    p_event_id UUID,
    p_seat_numbers JSONB,
    p_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    occupied_seats JSONB;
BEGIN
    -- Se não há assentos específicos, retorna verdadeiro
    IF p_seat_numbers = '[]'::jsonb OR p_seat_numbers IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Buscar assentos já ocupados (excluindo a própria reserva se for update)
    SELECT COALESCE(jsonb_agg(seat), '[]'::jsonb) INTO occupied_seats
    FROM (
        SELECT jsonb_array_elements_text(seat_numbers) as seat
        FROM bookings 
        WHERE event_id = p_event_id 
          AND status IN ('pending', 'confirmed')
          AND deleted_at IS NULL
          AND (p_booking_id IS NULL OR id != p_booking_id)
          AND seat_numbers != '[]'::jsonb
    ) seats;
    
    -- Verificar se há intersecção
    IF jsonb_typeof(occupied_seats) = 'array' AND jsonb_array_length(occupied_seats) > 0 THEN
        IF EXISTS (
            SELECT 1 
            FROM jsonb_array_elements_text(p_seat_numbers) as new_seat
            WHERE new_seat IN (
                SELECT jsonb_array_elements_text(occupied_seats)
            )
        ) THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular estatísticas de vendas
CREATE OR REPLACE FUNCTION get_sales_stats(
    p_event_id UUID DEFAULT NULL,
    p_venue_id UUID DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
    total_bookings BIGINT,
    total_tickets BIGINT,
    total_revenue NUMERIC,
    avg_booking_value NUMERIC,
    confirmed_bookings BIGINT,
    pending_bookings BIGINT,
    cancelled_bookings BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_bookings,
        SUM(b.quantity) as total_tickets,
        SUM(b.total_amount) as total_revenue,
        AVG(b.total_amount) as avg_booking_value,
        COUNT(*) FILTER (WHERE b.status = 'confirmed') as confirmed_bookings,
        COUNT(*) FILTER (WHERE b.status = 'pending') as pending_bookings,
        COUNT(*) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings
    FROM bookings b
    JOIN events e ON b.event_id = e.id
    WHERE b.deleted_at IS NULL
      AND (p_event_id IS NULL OR b.event_id = p_event_id)
      AND (p_venue_id IS NULL OR e.venue_id = p_venue_id)
      AND (p_start_date IS NULL OR b.booked_at >= p_start_date)
      AND (p_end_date IS NULL OR b.booked_at <= p_end_date);
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ===================================
-- MIGRATION 004: TRIGGERS PARA AUDIT TRAIL
-- ===================================

BEGIN;

-- Função genérica para audit trail (ajustada para Supabase)
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    old_data JSONB;
    new_data JSONB;
    changed_fields TEXT[] := '{}';
    field_name TEXT;
    current_user_id UUID;
BEGIN
    -- Tentar obter o usuário atual (pode não estar disponível em todos os contextos)
    BEGIN
        current_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        current_user_id := NULL;
    END;
    
    -- Preparar dados antigos e novos
    IF TG_OP = 'DELETE' THEN
        old_data := to_jsonb(OLD);
        new_data := NULL;
    ELSIF TG_OP = 'INSERT' THEN
        old_data := NULL;
        new_data := to_jsonb(NEW);
    ELSE -- UPDATE
        old_data := to_jsonb(OLD);
        new_data := to_jsonb(NEW);
        
        -- Identificar campos alterados
        FOR field_name IN SELECT jsonb_object_keys(new_data) LOOP
            IF old_data->field_name IS DISTINCT FROM new_data->field_name THEN
                changed_fields := array_append(changed_fields, field_name);
            END IF;
        END LOOP;
    END IF;
    
    -- Inserir log de auditoria
    INSERT INTO audit_log (
        table_name,
        record_id,
        operation,
        old_values,
        new_values,
        changed_fields,
        user_id
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE((NEW.id)::UUID, (OLD.id)::UUID),
        TG_OP,
        old_data,
        new_data,
        changed_fields,
        current_user_id
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers para atualizar updated_at
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_venues_updated_at
    BEFORE UPDATE ON venues
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_bookings_updated_at
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers de auditoria
CREATE TRIGGER trigger_audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER trigger_audit_venues
    AFTER INSERT OR UPDATE OR DELETE ON venues
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER trigger_audit_events
    AFTER INSERT OR UPDATE OR DELETE ON events
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER trigger_audit_bookings
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

COMMIT;

-- ===================================
-- MIGRATION 005: ROW LEVEL SECURITY (RLS)
-- ===================================

BEGIN;

-- Habilitar RLS nas tabelas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Políticas para Users
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas para Venues
CREATE POLICY "Anyone can view active venues" ON venues
    FOR SELECT USING (is_active = true AND deleted_at IS NULL);

CREATE POLICY "Venue managers can manage their venues" ON venues
    FOR ALL USING (
        manager_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas para Events
CREATE POLICY "Anyone can view published events" ON events
    FOR SELECT USING (
        status = 'published' AND is_active = true AND deleted_at IS NULL
    );

CREATE POLICY "Venue managers can manage their events" ON events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM venues 
            WHERE id = venue_id AND manager_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas para Bookings
CREATE POLICY "Users can view their own bookings" ON bookings
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own bookings" ON bookings
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own bookings" ON bookings
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Venue managers can view bookings for their events" ON bookings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM events e
            JOIN venues v ON e.venue_id = v.id
            WHERE e.id = event_id AND v.manager_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all bookings" ON bookings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Políticas para Audit Log
CREATE POLICY "Admins can view audit logs" ON audit_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

COMMIT;

-- ===================================
-- DADOS DE EXEMPLO (OPCIONAL)
-- ===================================

BEGIN;

-- Inserir usuário admin
INSERT INTO users (first_name, last_name, email, password_hash, role) VALUES
('Admin', 'Sistema', 'admin@ticketing.com', crypt('admin123', gen_salt('bf')), 'admin');

-- Inserir venue de exemplo
INSERT INTO venues (name, type, address, city, state, country, capacity, latitude, longitude) VALUES
('Cinema Central', 'cinema', 'Rua das Flores, 123', 'São Paulo', 'SP', 'Brasil', 200, -23.5505, -46.6333);

-- Inserir evento de exemplo
INSERT INTO events (
    title, 
    description, 
    type, 
    start_date_time, 
    end_date_time, 
    price, 
    available_tickets, 
    status, 
    venue_id
) VALUES (
    'Filme: Aventura Espacial',
    'Um filme épico sobre exploração espacial',
    'movie',
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '1 day' + INTERVAL '2 hours',
    25.00,
    200,
    'published',
    (SELECT id FROM venues WHERE name = 'Cinema Central')
);

COMMIT;