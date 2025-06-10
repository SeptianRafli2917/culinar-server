import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../routes";
import serverless from 'serverless-http';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

registerRoutes(app);

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "Welcome to the API! Use /api for API routes.",
    status: "ok",
  });
});


app.listen(5000, () => {
  console.log("Server is running on port 5000");
});

export default module.exports = app;