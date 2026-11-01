import { Review } from '../models/Review.js';
import { sendSuccess, sendError } from '../utils/response.js';

const DEFAULT_REVIEWS = [
  {
    name: 'Alexandre M.',
    role: 'Trader Prop Firm FTMO',
    rating: 5,
    country: 'FR',
    comment: "J'ai validé mon challenge FTMO 100k en 12 jours grâce au Robot Haute Probabilité et aux confluences SMC. La détection des liquidités et des FVG est d'une précision chirurgicale.",
    featured: true,
    active: true,
    order: 1,
  },
  {
    name: 'Jean-Marc D.',
    role: 'Trader Forex & Or (XAU/USD)',
    rating: 5,
    country: 'CI',
    comment: "Le robot et le scanner m'évitent le surtrading et les erreurs émotionnelles. Quand l'IA donne un score supérieur à 90% sur l'or, le take profit est touché 9 fois sur 10.",
    featured: true,
    active: true,
    order: 2,
  },
  {
    name: 'Sarah L.',
    role: 'Swing Trader Indices (NAS100 / US30)',
    rating: 5,
    country: 'SN',
    comment: "Le mode Multi-Timeframe Confluence et la surveillance automatique ont transformé mon quotidien. Plus besoin de rester scotché aux écrans 8h par jour.",
    featured: true,
    active: true,
    order: 3,
  },
  {
    name: 'Kevin B.',
    role: 'Spécialiste Indices Synthétiques Deriv',
    rating: 5,
    country: 'CM',
    comment: "Enfin une IA qui comprend réellement le Volatility 75, Crash 1000 et Boom 1000 ! Les signaux sont ultra nets et les points d'entrée au millimètre.",
    featured: true,
    active: true,
    order: 4,
  },
  {
    name: 'Moussa K.',
    role: 'Day Trader Crypto & Forex',
    rating: 5,
    country: 'SN',
    comment: "Le copilote vocal et le validateur de trade avant chaque prise de position ont divisé mes pertes par 3. Un investissement rentabilisé dès la première semaine.",
    featured: true,
    active: true,
    order: 5,
  },
  {
    name: 'David T.',
    role: 'Trader Part-Time & Développeur',
    rating: 5,
    country: 'BE',
    comment: "La clarté des ratios Risque/Rendement (1:3 à 1:5) et le backtesting replay avec l'outil cut permettent d'affiner n'importe quelle stratégie en quelques minutes.",
    featured: true,
    active: true,
    order: 6,
  },
];

/** Seed default reviews if table is empty */
const ensureSeeded = async () => {
  const count = await Review.countDocuments();
  if (count === 0) {
    await Review.insertMany(DEFAULT_REVIEWS);
  }
};

/** Public endpoint to fetch active reviews for landing page carousel */
export const getPublicReviews = async (req, res) => {
  try {
    await ensureSeeded();
    const reviews = await Review.find({ active: true }).sort({ order: 1, createdAt: -1 });
    return sendSuccess(res, 200, { reviews });
  } catch (err) {
    return sendError(res, 500, 'Erreur lors de la récupération des avis', err.message);
  }
};

/** Admin endpoint to list all reviews */
export const getAdminReviews = async (req, res) => {
  try {
    await ensureSeeded();
    const reviews = await Review.find().sort({ order: 1, createdAt: -1 });
    return sendSuccess(res, 200, { reviews });
  } catch (err) {
    return sendError(res, 500, 'Erreur admin avis', err.message);
  }
};

/** Admin: Create a new review */
export const createReview = async (req, res) => {
  try {
    const { name, role, rating, comment, country, featured, active, order } = req.body;
    if (!name || !comment) {
      return sendError(res, 400, 'Nom et commentaire requis');
    }
    const review = await Review.create({
      name,
      role: role || 'Trader Indépendant',
      rating: Number(rating) || 5,
      comment,
      country: country || 'FR',
      featured: featured !== undefined ? Boolean(featured) : true,
      active: active !== undefined ? Boolean(active) : true,
      order: Number(order) || 0,
    });
    return sendSuccess(res, 201, { review }, 'Avis ajouté avec succès');
  } catch (err) {
    return sendError(res, 500, "Erreur lors de l'ajout de l'avis", err.message);
  }
};

/** Admin: Update an existing review */
export const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, rating, comment, country, featured, active, order } = req.body;

    const review = await Review.findById(id);
    if (!review) {
      return sendError(res, 404, 'Avis introuvable');
    }

    if (name !== undefined) review.name = name;
    if (role !== undefined) review.role = role;
    if (rating !== undefined) review.rating = Number(rating);
    if (comment !== undefined) review.comment = comment;
    if (country !== undefined) review.country = country;
    if (featured !== undefined) review.featured = Boolean(featured);
    if (active !== undefined) review.active = Boolean(active);
    if (order !== undefined) review.order = Number(order);

    await review.save();
    return sendSuccess(res, 200, { review }, 'Avis mis à jour avec succès');
  } catch (err) {
    return sendError(res, 500, "Erreur lors de la mise à jour de l'avis", err.message);
  }
};

/** Admin: Delete a review */
export const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Review.findByIdAndDelete(id);
    if (!deleted) {
      return sendError(res, 404, 'Avis introuvable');
    }
    return sendSuccess(res, 200, null, 'Avis supprimé avec succès');
  } catch (err) {
    return sendError(res, 500, "Erreur lors de la suppression de l'avis", err.message);
  }
};
