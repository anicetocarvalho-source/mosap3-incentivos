
UPDATE supplier_products SET stock = stock - 2 WHERE id='b8b195ae-91ca-443c-8b0b-61548b928390';

UPDATE farmers
SET total_gasto = '2280,00',
    saldo_final = '197720,00'
WHERE code='AGR-973240696';

INSERT INTO farmer_balance_history (farmer_code, field, old_value, new_value, delta, source, source_ref, notes)
VALUES ('AGR-973240696', 'total_gasto', '0,00', '2280,00', 2280, 'pos_sale', 'V-E2E-TEST-001', 'Teste E2E do fluxo POS');
