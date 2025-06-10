import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRecipeSchema } from "./shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for image uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.resolve(process.cwd(), "dist/public/uploads");
      
      // Create the directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Create a unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `recipe-${uniqueSuffix}${ext}`);
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  const apiRouter = app.route('/api');

  // Get all recipes
  app.get('/api/recipes', async (req, res) => {
    try {
      if (req.query.category && typeof req.query.category === 'string') {
        const recipes = await storage.getRecipesByCategory(req.query.category);
        return res.json(recipes);
      }
      
      if (req.query.search && typeof req.query.search === 'string') {
        const recipes = await storage.searchRecipes(req.query.search);
        return res.json(recipes);
      }
      
      const recipes = await storage.getAllRecipes();
      res.json(recipes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get a specific recipe by ID
  app.get('/api/recipes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid recipe ID' });
      }
      
      const recipe = await storage.getRecipeById(id);
      if (!recipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }
      
      res.json(recipe);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new recipe
  app.post('/api/recipes', upload.single('image'), async (req, res) => {
    try {
      // Extract recipe data from request body
      const recipeData = JSON.parse(req.body.recipe);
      
      // Add imageUrl if an image was uploaded
      if (req.file) {
        // Save the relative path to the image
        recipeData.imageUrl = `/uploads/${req.file.filename}`;
      }
      
      // Add creation timestamp
      recipeData.createdAt = new Date().toISOString();
      
      // Validate recipe data
      const validatedData = insertRecipeSchema.parse(recipeData);
      
      // Create the recipe
      const newRecipe = await storage.createRecipe(validatedData);
      
      res.status(201).json(newRecipe);
    } catch (error: any) {
      // Clean up the uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors });
      }
      
      res.status(500).json({ message: error.message });
    }
  });

  // Update a recipe
  app.put('/api/recipes/:id', upload.single('image'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid recipe ID' });
      }
      
      // Check if recipe exists
      const existingRecipe = await storage.getRecipeById(id);
      if (!existingRecipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }
      
      // Extract recipe data from request body
      const recipeData = JSON.parse(req.body.recipe);
      
      // Add imageUrl if an image was uploaded
      if (req.file) {
        // Delete old image if exists
        if (existingRecipe.imageUrl) {
          const oldImagePath = path.resolve(
            process.cwd(), 
            'dist/public', 
            existingRecipe.imageUrl.replace(/^\//, '')
          );
          
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        
        // Save the relative path to the new image
        recipeData.imageUrl = `/uploads/${req.file.filename}`;
      }
      
      // Update the recipe
      const updatedRecipe = await storage.updateRecipe(id, recipeData);
      
      res.json(updatedRecipe);
    } catch (error: any) {
      // Clean up the uploaded file if validation fails
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: error.errors });
      }
      
      res.status(500).json({ message: error.message });
    }
  });

  // Delete a recipe
  app.delete('/api/recipes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid recipe ID' });
      }
      
      // Check if recipe exists and get it to delete image if needed
      const existingRecipe = await storage.getRecipeById(id);
      if (!existingRecipe) {
        return res.status(404).json({ message: 'Recipe not found' });
      }
      
      // Delete the image file if it exists
      if (existingRecipe.imageUrl) {
        const imagePath = path.resolve(
          process.cwd(), 
          'dist/public', 
          existingRecipe.imageUrl.replace(/^\//, '')
        );
        
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      // Delete the recipe
      const result = await storage.deleteRecipe(id);
      
      if (!result) {
        return res.status(404).json({ message: 'Recipe not found' });
      }
      
      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
