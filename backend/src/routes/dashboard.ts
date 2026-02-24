import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { getDashboardData } from "../services/dashboardService";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const data = await getDashboardData(userId);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ message: err.message || "Erro ao carregar dashboard" });
  }
});

export default router;
