from app import create_app

# Create the Flask app using the application factory
app = create_app()

if __name__ == "__main__":
    # Run the application without debug mode for production
    app.run(debug=True)