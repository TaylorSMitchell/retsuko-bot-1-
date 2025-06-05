const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Retsuko está viva!");
});

const port = 3000;
app.listen(port, () => {
  console.log(`Servidor ativo na porta ${port}`);
});
