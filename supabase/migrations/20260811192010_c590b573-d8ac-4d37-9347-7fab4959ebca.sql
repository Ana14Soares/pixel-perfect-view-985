
-- ENUMS
CREATE TYPE public.equipamento_status AS ENUM ('DISPONIVEL','EMPRESTADO','MANUTENCAO','EXTRAVIADO','BAIXADO');
CREATE TYPE public.condicao_devolucao AS ENUM ('OK','AVARIADO');

-- TABELAS
CREATE TABLE public.alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matricula text NOT NULL UNIQUE,
  nome text NOT NULL,
  email text,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patrimonio text NOT NULL UNIQUE,
  nome text NOT NULL,
  categoria text NOT NULL,
  status public.equipamento_status NOT NULL DEFAULT 'DISPONIVEL',
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.emprestimos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id),
  retirado_em timestamptz NOT NULL DEFAULT now(),
  previsto_para date NOT NULL,
  devolvido_em timestamptz,
  condicao_devolucao public.condicao_devolucao,
  observacao_devolucao text,
  cancelado_em timestamptz,
  motivo_cancelamento text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX emprestimos_equipamento_aberto_uniq
  ON public.emprestimos (equipamento_id)
  WHERE devolvido_em IS NULL AND cancelado_em IS NULL;

CREATE INDEX emprestimos_aluno_idx ON public.emprestimos (aluno_id);

CREATE TABLE public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  dados jsonb,
  usuario_id uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alunos TO authenticated;
GRANT ALL ON public.alunos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipamentos TO authenticated;
GRANT ALL ON public.equipamentos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.emprestimos TO authenticated;
GRANT ALL ON public.emprestimos TO service_role;
GRANT SELECT, INSERT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;

-- RLS
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emprestimos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tecnico gerencia alunos" ON public.alunos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tecnico gerencia equipamentos" ON public.equipamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tecnico gerencia emprestimos" ON public.emprestimos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "tecnico le auditoria" ON public.auditoria FOR SELECT TO authenticated USING (true);
CREATE POLICY "tecnico insere auditoria" ON public.auditoria FOR INSERT TO authenticated WITH CHECK (true);

-- HELPERS
CREATE OR REPLACE FUNCTION public.hoje_local()
RETURNS date LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT (now() AT TIME ZONE 'America/Fortaleza')::date
$$;

CREATE OR REPLACE FUNCTION public.aluno_pendencia(p_aluno_id uuid)
RETURNS TABLE (qtd integer, maior_atraso integer)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COUNT(*)::int,
         COALESCE(MAX(GREATEST(public.hoje_local() - e.previsto_para, 0)), 0)::int
  FROM public.emprestimos e
  WHERE e.aluno_id = p_aluno_id
    AND e.devolvido_em IS NULL
    AND e.cancelado_em IS NULL
    AND e.previsto_para < public.hoje_local()
$$;

-- EMPRESTAR
CREATE OR REPLACE FUNCTION public.fn_emprestar(p_aluno_id uuid, p_equipamento_id uuid, p_previsto_para date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_aluno public.alunos%ROWTYPE;
  v_eq public.equipamentos%ROWTYPE;
  v_pend record;
  v_abertos int;
  v_dias int;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_AUTENTICADO', 'mensagem', 'Sessão expirada. Faça login novamente.');
  END IF;

  SELECT * INTO v_aluno FROM public.alunos WHERE id = p_aluno_id;
  IF NOT FOUND OR v_aluno.ativo = false THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'ALUNO_INATIVO', 'mensagem', 'Aluno não encontrado ou inativo. Não pode receber empréstimos.');
  END IF;

  SELECT * INTO v_pend FROM public.aluno_pendencia(p_aluno_id);
  IF v_pend.qtd > 0 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PENDENCIA', 'mensagem',
      v_aluno.nome || ' possui ' || v_pend.qtd || ' devolução(ões) vencida(s) há ' || v_pend.maior_atraso || ' dia(s)');
  END IF;

  SELECT COUNT(*) INTO v_abertos FROM public.emprestimos
   WHERE aluno_id = p_aluno_id AND devolvido_em IS NULL AND cancelado_em IS NULL;
  IF v_abertos >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'LIMITE_EXCEDIDO', 'mensagem',
      v_aluno.nome || ' já possui ' || v_abertos || ' empréstimos em aberto (máximo 3)');
  END IF;

  SELECT * INTO v_eq FROM public.equipamentos WHERE id = p_equipamento_id;
  IF NOT FOUND OR v_eq.status <> 'DISPONIVEL' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Equipamento não está disponível para empréstimo.');
  END IF;

  v_dias := p_previsto_para - public.hoje_local();
  IF p_previsto_para IS NULL OR v_dias < 1 OR v_dias > 30 THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'PRAZO_INVALIDO', 'mensagem', 'O prazo deve ser entre 1 e 30 dias corridos a partir de hoje.');
  END IF;

  BEGIN
    INSERT INTO public.emprestimos (aluno_id, equipamento_id, previsto_para, retirado_em)
    VALUES (p_aluno_id, p_equipamento_id, p_previsto_para, now())
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'INDISPONIVEL', 'mensagem', 'Equipamento não está disponível para empréstimo.');
  END;

  UPDATE public.equipamentos SET status = 'EMPRESTADO' WHERE id = p_equipamento_id;

  INSERT INTO public.auditoria (acao, entidade, entidade_id, dados, usuario_id)
  VALUES ('EMPRESTIMO_CRIADO', 'emprestimos', v_id,
    jsonb_build_object('aluno_id', p_aluno_id, 'equipamento_id', p_equipamento_id, 'previsto_para', p_previsto_para), auth.uid());

  RETURN jsonb_build_object('ok', true, 'emprestimo_id', v_id, 'mensagem', 'Empréstimo registrado para ' || v_aluno.nome || ' — ' || v_eq.patrimonio);
END;
$fn$;

-- DEVOLVER
CREATE OR REPLACE FUNCTION public.fn_devolver(p_emprestimo_id uuid, p_condicao public.condicao_devolucao, p_observacao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_emp public.emprestimos%ROWTYPE;
  v_eq public.equipamentos%ROWTYPE;
  v_novo public.equipamento_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_AUTENTICADO', 'mensagem', 'Sessão expirada. Faça login novamente.');
  END IF;

  SELECT * INTO v_emp FROM public.emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'Empréstimo não encontrado.');
  END IF;
  IF v_emp.devolvido_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'JA_DEVOLVIDO', 'mensagem', 'Este empréstimo já foi devolvido em ' || to_char(v_emp.devolvido_em AT TIME ZONE 'America/Fortaleza', 'DD/MM/YYYY HH24:MI') || '.');
  END IF;
  IF v_emp.cancelado_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'CANCELADO', 'mensagem', 'Este empréstimo foi cancelado e não pode ser devolvido.');
  END IF;

  SELECT * INTO v_eq FROM public.equipamentos WHERE id = v_emp.equipamento_id;
  v_novo := CASE WHEN p_condicao = 'AVARIADO' THEN 'MANUTENCAO'::public.equipamento_status ELSE 'DISPONIVEL'::public.equipamento_status END;

  UPDATE public.emprestimos
     SET devolvido_em = now(), condicao_devolucao = p_condicao, observacao_devolucao = p_observacao
   WHERE id = p_emprestimo_id;

  UPDATE public.equipamentos SET status = v_novo WHERE id = v_emp.equipamento_id;

  INSERT INTO public.auditoria (acao, entidade, entidade_id, dados, usuario_id)
  VALUES ('DEVOLUCAO_REGISTRADA', 'emprestimos', p_emprestimo_id,
    jsonb_build_object('condicao', p_condicao, 'observacao', p_observacao, 'equipamento_status', v_novo), auth.uid());

  RETURN jsonb_build_object('ok', true, 'mensagem', 'Devolução registrada — ' || v_eq.patrimonio || ' agora está ' || v_novo);
END;
$fn$;

-- CANCELAR
CREATE OR REPLACE FUNCTION public.fn_cancelar(p_emprestimo_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_emp public.emprestimos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_AUTENTICADO', 'mensagem', 'Sessão expirada. Faça login novamente.');
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'MOTIVO_OBRIGATORIO', 'mensagem', 'Informe o motivo do cancelamento.');
  END IF;

  SELECT * INTO v_emp FROM public.emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'Empréstimo não encontrado.');
  END IF;
  IF v_emp.devolvido_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'JA_DEVOLVIDO', 'mensagem', 'Empréstimo já devolvido não pode ser cancelado.');
  END IF;
  IF v_emp.cancelado_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'JA_CANCELADO', 'mensagem', 'Este empréstimo já foi cancelado.');
  END IF;

  UPDATE public.emprestimos SET cancelado_em = now(), motivo_cancelamento = p_motivo WHERE id = p_emprestimo_id;
  UPDATE public.equipamentos SET status = 'DISPONIVEL' WHERE id = v_emp.equipamento_id;

  INSERT INTO public.auditoria (acao, entidade, entidade_id, dados, usuario_id)
  VALUES ('EMPRESTIMO_CANCELADO', 'emprestimos', p_emprestimo_id, jsonb_build_object('motivo', p_motivo), auth.uid());

  RETURN jsonb_build_object('ok', true, 'mensagem', 'Empréstimo cancelado e equipamento liberado.');
END;
$fn$;

-- EXTRAVIO
CREATE OR REPLACE FUNCTION public.fn_marcar_extravio(p_emprestimo_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_emp public.emprestimos%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_AUTENTICADO', 'mensagem', 'Sessão expirada. Faça login novamente.');
  END IF;
  SELECT * INTO v_emp FROM public.emprestimos WHERE id = p_emprestimo_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_ENCONTRADO', 'mensagem', 'Empréstimo não encontrado.');
  END IF;
  IF v_emp.devolvido_em IS NOT NULL OR v_emp.cancelado_em IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_EM_ABERTO', 'mensagem', 'Só é possível marcar extravio em empréstimo em aberto.');
  END IF;

  UPDATE public.equipamentos SET status = 'EXTRAVIADO' WHERE id = v_emp.equipamento_id;

  INSERT INTO public.auditoria (acao, entidade, entidade_id, dados, usuario_id)
  VALUES ('STATUS_EQUIPAMENTO_ALTERADO', 'equipamentos', v_emp.equipamento_id,
    jsonb_build_object('status', 'EXTRAVIADO', 'emprestimo_id', p_emprestimo_id), auth.uid());

  RETURN jsonb_build_object('ok', true, 'mensagem', 'Equipamento marcado como EXTRAVIADO. O empréstimo continua em aberto.');
END;
$fn$;

-- ALTERAR STATUS MANUAL (auditado)
CREATE OR REPLACE FUNCTION public.fn_alterar_status_equipamento(p_equipamento_id uuid, p_status public.equipamento_status)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_aberto int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_AUTENTICADO', 'mensagem', 'Sessão expirada. Faça login novamente.');
  END IF;
  SELECT COUNT(*) INTO v_aberto FROM public.emprestimos
   WHERE equipamento_id = p_equipamento_id AND devolvido_em IS NULL AND cancelado_em IS NULL;
  IF v_aberto > 0 AND p_status IN ('DISPONIVEL','BAIXADO') THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'EMPRESTIMO_ABERTO', 'mensagem', 'Existe empréstimo em aberto para este equipamento.');
  END IF;

  UPDATE public.equipamentos SET status = p_status WHERE id = p_equipamento_id;
  INSERT INTO public.auditoria (acao, entidade, entidade_id, dados, usuario_id)
  VALUES ('STATUS_EQUIPAMENTO_ALTERADO', 'equipamentos', p_equipamento_id, jsonb_build_object('status', p_status), auth.uid());
  RETURN jsonb_build_object('ok', true, 'mensagem', 'Status atualizado para ' || p_status || '.');
END;
$fn$;

-- RESET DEMO
CREATE OR REPLACE FUNCTION public.fn_reset_demo()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  d date := public.hoje_local();
  a1 uuid; a2 uuid; a3 uuid;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid;
  base_ts timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'codigo', 'NAO_AUTENTICADO', 'mensagem', 'Sessão expirada. Faça login novamente.');
  END IF;

  DELETE FROM public.auditoria;
  DELETE FROM public.emprestimos;
  DELETE FROM public.equipamentos;
  DELETE FROM public.alunos;

  base_ts := (d::timestamp + interval '12 hours') AT TIME ZONE 'America/Fortaleza';

  INSERT INTO public.alunos (matricula, nome, email, telefone, ativo) VALUES
    ('2021001','Ana Souza','ana.souza@lab.edu.br','(85) 90000-0001', true) RETURNING id INTO a1;
  INSERT INTO public.alunos (matricula, nome, email, telefone, ativo) VALUES
    ('2021002','Bruno Lima','bruno.lima@lab.edu.br','(85) 90000-0002', true) RETURNING id INTO a2;
  INSERT INTO public.alunos (matricula, nome, email, telefone, ativo) VALUES
    ('2021003','Carla Dias','carla.dias@lab.edu.br','(85) 90000-0003', true) RETURNING id INTO a3;
  INSERT INTO public.alunos (matricula, nome, email, telefone, ativo) VALUES
    ('2021004','Diego Rocha','diego.rocha@lab.edu.br','(85) 90000-0004', true),
    ('2021005','Elisa Nunes','elisa.nunes@lab.edu.br','(85) 90000-0005', false);

  INSERT INTO public.equipamentos (patrimonio, nome, categoria, status) VALUES
    ('EQ-001','Multímetro Digital','Instrumentação','EMPRESTADO') RETURNING id INTO e1;
  INSERT INTO public.equipamentos (patrimonio, nome, categoria, status) VALUES
    ('EQ-002','Osciloscópio','Instrumentação','EMPRESTADO') RETURNING id INTO e2;
  INSERT INTO public.equipamentos (patrimonio, nome, categoria, status) VALUES
    ('EQ-003','Fonte de Bancada','Alimentação','EMPRESTADO') RETURNING id INTO e3;
  INSERT INTO public.equipamentos (patrimonio, nome, categoria, status) VALUES
    ('EQ-004','Gerador de Funções','Instrumentação','EMPRESTADO') RETURNING id INTO e4;
  INSERT INTO public.equipamentos (patrimonio, nome, categoria, status) VALUES
    ('EQ-005','Estação de Solda','Ferramentas','EMPRESTADO') RETURNING id INTO e5;
  INSERT INTO public.equipamentos (patrimonio, nome, categoria, status) VALUES
    ('EQ-006','Multímetro Digital','Instrumentação','DISPONIVEL'),
    ('EQ-007','Paquímetro','Ferramentas','DISPONIVEL'),
    ('EQ-008','Alicate Amperímetro','Instrumentação','DISPONIVEL'),
    ('EQ-009','Osciloscópio','Instrumentação','MANUTENCAO');

  INSERT INTO public.emprestimos (aluno_id, equipamento_id, retirado_em, previsto_para) VALUES
    (a1, e1, base_ts - interval '8 days', d - 1),
    (a2, e2, base_ts - interval '2 days', d + 5),
    (a3, e3, base_ts - interval '4 days', d + 3),
    (a3, e4, base_ts - interval '3 days', d + 4),
    (a3, e5, base_ts - interval '1 days', d + 6);

  INSERT INTO public.auditoria (acao, entidade, entidade_id, dados, usuario_id)
  VALUES ('RESET_DEMO', 'sistema', NULL, jsonb_build_object('data_referencia', d), auth.uid());

  RETURN jsonb_build_object('ok', true, 'mensagem', 'Dados de demonstração recriados com referência em ' || to_char(d, 'DD/MM/YYYY') || '.');
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.fn_emprestar(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_devolver(uuid, public.condicao_devolucao, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cancelar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_marcar_extravio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_alterar_status_equipamento(uuid, public.equipamento_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reset_demo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hoje_local() TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_pendencia(uuid) TO authenticated;
