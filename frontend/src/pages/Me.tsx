import { useEffect, useState } from "react"
import { Box, Button, Card, CardContent, TextField, Typography } from "@mui/material"
import axios from "axios"

export default function Me() {
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setMsg(null)
      const { data } = await axios.get("/auth/me")
      setName(data.name || "")
      setEmail(data.email || "")
      setLoading(false)
    }
    run()
  }, [])

  const save = async () => {
    setMsg(null)
    await axios.put("/auth/me", {
      name: name || undefined,
      email: email || undefined,
      password: password || undefined,
    })
    setPassword("")
    setMsg("Perfil atualizado")
  }

  return (
    <Box sx={{ maxWidth: 520, mx: "auto", mt: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Meu Perfil</Typography>

          <TextField
            fullWidth
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2 }}
            disabled={loading}
          />

          <TextField
            fullWidth
            label="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 2 }}
            disabled={loading}
          />

          <TextField
            fullWidth
            label="Nova senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 2 }}
            disabled={loading}
          />

          <Button variant="contained" fullWidth onClick={save} disabled={loading}>
            Salvar
          </Button>

          {msg && (
            <Typography sx={{ mt: 2 }}>
              {msg}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
