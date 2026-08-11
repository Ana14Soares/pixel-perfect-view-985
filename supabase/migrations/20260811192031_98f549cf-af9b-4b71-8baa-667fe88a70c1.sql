
REVOKE EXECUTE ON FUNCTION public.fn_emprestar(uuid, uuid, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_devolver(uuid, public.condicao_devolucao, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_cancelar(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_marcar_extravio(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_alterar_status_equipamento(uuid, public.equipamento_status) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.fn_reset_demo() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.hoje_local() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.aluno_pendencia(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fn_emprestar(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_devolver(uuid, public.condicao_devolucao, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cancelar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_marcar_extravio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_alterar_status_equipamento(uuid, public.equipamento_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_reset_demo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hoje_local() TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_pendencia(uuid) TO authenticated;
