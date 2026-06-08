# Project Estimation Calculator

A full-stack web application for calculating project estimates based on effort hours, complexity scores, and resource costs.

## Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Axios** - HTTP client for API calls
- **CSS3** - Styling

### Backend
- **Python 3.x** - Programming language
- **FastAPI** - Modern, fast web framework
- **SQLAlchemy** - ORM for database operations
- **Pydantic** - Data validation
- **SQLite** - Local database (PostgreSQL ready for production)

## Project Structure

```
project-estimation-calculator/
├── frontend/                    # React + Vite application
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── api.js              # API integration
│   │   ├── App.jsx             # Main app component
│   │   ├── main.jsx            # Entry point
│   │   ├── index.css           # Global styles
│   │   └── App.css             # App styles
│   ├── index.html              # HTML template
│   ├── vite.config.js          # Vite configuration
│   └── package.json            # Dependencies
│
├── backend/                     # FastAPI application
│   ├── app/
│   │   ├── main.py             # FastAPI app initialization
│   │   ├── database.py         # Database configuration
│   │   ├── models.py           # SQLAlchemy models
│   │   ├── schemas.py          # Pydantic schemas
│   │   ├── calculator.py       # Estimation logic
│   │   ├── crud.py             # Database operations
│   │   └── routes/
│   │       └── estimates.py    # API endpoints
│   ├── requirements.txt         # Python dependencies
│   └── .env                     # Environment variables
│
├── docs/                        # Documentation
├── README.md                    # This file
└── .gitignore                   # Git ignore rules
```

## Getting Started

### Prerequisites
- **Node.js 18+** (for frontend)
- **Python 3.8+** (for backend)
- **pip** (Python package manager)
- **npm or yarn** (Node package manager)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Configure environment variables:
The `.env` file is already created with default settings. Modify if needed.

5. Run the backend server:
```bash
# Development mode with auto-reload
python -m uvicorn app.main:app --reload

# Or using the main.py directly (if __name__ == "__main__" is configured)
python app/main.py
```

The API will be available at `http://localhost:8000`
- API Documentation: `http://localhost:8000/docs`
- OpenAPI Schema: `http://localhost:8000/openapi.json`

### Frontend Setup

1. Navigate to the frontend directory (in a new terminal):
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

## API Endpoints

### Base URL: `http://localhost:8000`

#### Health Check
- `GET /health` - Check if API is running

#### Estimates
- `POST /api/estimates/` - Create a new estimate
- `GET /api/estimates/` - Get all estimates (with pagination)
- `GET /api/estimates/{id}` - Get a specific estimate
- `PUT /api/estimates/{id}` - Update an estimate
- `DELETE /api/estimates/{id}` - Delete an estimate

### Request Example

**Create Estimate:**
```bash
curl -X POST http://localhost:8000/api/estimates/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Website Redesign",
    "description": "Complete redesign of corporate website",
    "effort_hours": 120,
    "complexity_score": 7,
    "resource_cost": 75
  }'
```

### Estimation Formula

```
total_cost = effort_hours × resource_cost × complexity_multiplier
complexity_multiplier = 0.9 + (complexity_score × 0.1)
```

**Examples:**
- Complexity 1: multiplier = 1.0x
- Complexity 5: multiplier = 1.4x
- Complexity 10: multiplier = 1.9x

## Development Workflow

### Running Both Frontend and Backend

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python -m uvicorn app.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Then open `http://localhost:5173` in your browser.

## Building for Production

### Frontend
```bash
cd frontend
npm run build
```

Output will be in `frontend/dist/`

### Backend
For production deployment:
1. Update `.env` with production settings
2. Update `CORS_ORIGINS` in `backend/app/main.py`
3. Use PostgreSQL instead of SQLite
4. Use a production ASGI server (Gunicorn, etc.)

```bash
# Example with Gunicorn
pip install gunicorn
gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app
```

## Database

### Local Development
- **Default:** SQLite (`test.db`)
- **Location:** `backend/test.db`

### Production Migration
To use PostgreSQL:
1. Install PostgreSQL driver: `pip install psycopg2-binary`
2. Update `.env`: `DATABASE_URL=postgresql://user:password@localhost/dbname`
3. Tables are auto-created on first run

## Features

✅ Create project estimates with detailed parameters
✅ View all estimates in an organized list
✅ Edit existing estimates
✅ Delete estimates
✅ Real-time calculation of project costs
✅ Responsive design for mobile and desktop
✅ REST API with full CRUD operations
✅ Database persistence with SQLite/PostgreSQL
✅ Input validation and error handling
✅ CORS enabled for frontend-backend communication

## Future Enhancements

- User authentication and authorization
- Multiple user workspaces
- Estimate templates
- Historical tracking and analytics
- Export estimates to PDF/CSV
- Team collaboration features
- Budget tracking and actuals vs estimates
- Integration with project management tools

## Troubleshooting

### CORS Errors
If you see CORS errors in the browser console:
1. Ensure the backend is running on `http://localhost:8000`
2. Check that frontend is on `http://localhost:5173`
3. Verify CORS_ORIGINS in `backend/app/main.py` includes your frontend URL

### Port Already in Use
- Backend port 8000: Change `API_PORT` in `.env`
- Frontend port 5173: Change port in `frontend/vite.config.js`

### Database Connection Issues
- Delete `backend/test.db` to reset SQLite
- Check `.env` DATABASE_URL is correctly formatted
- Ensure database directory has write permissions

## License

This project is open source and available under the MIT License.

## Contact

For questions or support, please open an issue in the repository.
