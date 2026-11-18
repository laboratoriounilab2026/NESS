import { expect, test } from "@playwright/test";

// Jornada do operador sem regra fiscal aprovada: o pedido é salvo, mas nunca fica emitível.

test("login exige credenciais válidas", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("E-mail").fill("operador@e2e.test");
  await page.getByLabel("Senha").fill("senha-errada-123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.locator("form").getByRole("alert")).toBeVisible(); // escopo: o Next tem um anunciador de rota com role=alert
});

test("pedido sem regra fiscal é salvo bloqueado e não pode ser emitido", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("operador@e2e.test");
  await page.getByLabel("Senha").fill(process.env.E2E_PASSWORD ?? "");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/);

  await page.goto("/pedidos/novo");
  const next = page.getByRole("button", { name: "Continuar" });

  // Validação inline: avançar vazio mostra erro e não sai da etapa.
  await next.click();
  await expect(page.getByText("CPF ou CNPJ inválido")).toBeVisible();

  await page.getByLabel("CPF ou CNPJ", { exact: true }).fill("529.982.247-25"); // CPF de exemplo (dígitos válidos), não real
  await page.getByLabel("Nome ou razão social").fill("Cliente E2E");
  await next.click();

  await page.getByLabel("Nome de quem recebe").fill("Destinatário E2E");
  await page.getByLabel("CEP").fill("01001000");
  await page.getByLabel("Rua").fill("Praça da Sé");
  await page.getByLabel("Número").fill("1");
  await page.getByLabel("Bairro").fill("Sé");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("UF").selectOption("SP");
  await next.click();

  await page.getByLabel("Descrição do serviço").fill("Ensaio fotográfico E2E");
  await page.getByLabel("Valor do serviço (R$)").fill("500,00");
  await next.click();

  await page.getByLabel("Descrição do álbum").fill("Álbum E2E");
  await page.getByLabel("Valor unitário (R$)").fill("200,00");
  await next.click();

  // Verificação fiscal: sem regra aprovada, as duas notas ficam bloqueadas.
  await expect(page.getByRole("note")).toContainText("não pode ser emitido");
  await next.click();
  await next.click();

  const save = page.getByRole("button", { name: "Salvar pedido" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Conferi os dados das duas notas").check();
  await save.click();

  await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Sem regra fiscal").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Verificar regras de novo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Emitir notas" })).toHaveCount(0);
  await expect(page.getByText("529.982.247-25")).toHaveCount(0); // documento mascarado
});
