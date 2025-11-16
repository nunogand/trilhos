# Trilhos - Mountain Trail Photography

A responsive web gallery showcasing mountain trail photography with interactive maps and beautiful image galleries.

## Features

- **Responsive Design**: Fully responsive layout that adapts to all screen sizes
- **Interactive Maps**: OpenStreetMap integration with GPX track visualization
- **Image Gallery**: Seamless image gallery with lightbox functionality
- **Element Reordering**: Smart layout reordering based on screen size
- **Modern CSS**: Utilizes CSS Grid and Flexbox with fallbacks for older browsers

## Technologies Used

- **HTML5**: Semantic markup structure
- **CSS3**: Modern CSS with Grid, Flexbox, and media queries
- **JavaScript**: Vanilla JS for interactivity
- **Leaflet.js**: Interactive maps
- **Leaflet GPX Plugin**: GPX track visualization

## Project Structure

```
trilhos/
├── assets/
│   ├── about.jpg
│   ├── about_2.jpg
│   └── trilho1/
│       └── track.gpx
├── index.html
├── gallery.html
├── about.html
└── README.md
```

## Pages

### Home Page (index.html)
- Hero section with mountain imagery
- Photography blog with post cards
- Mountain silhouette background

### Gallery Page (gallery.html)
- Interactive map with GPX track
- Image gallery with lightbox
- Responsive grid layout

### About Page (about.html)
- Information about the project
- Responsive layout with element reordering
- Quote section and imagery

## CSS Architecture

The CSS is organized into two main sections:

1. **Grid/Flexbox System**: Handles layout and responsive behavior
2. **All Other Styles**: Typography, colors, and component styling

### Grid System Features

- Mobile-first approach
- 12-column grid system
- Flexbox fallback for older browsers
- Responsive breakpoints at 62rem (992px)
- Element reordering on smaller screens

### Element Reordering

On screens smaller than 62rem, elements with IDs "4" and "5" in the about page are reordered:
- Normal order: 1, 2, 3, 4, 5
- Small screens: 1, 2, 3, 5, 4

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- IE11 (with limited functionality)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/nunogand/trilhos.git
   ```

2. Navigate to the project directory:
   ```bash
   cd trilhos
   ```

3. Open `index.html` in your browser to view the project.

## Usage

### Viewing the Project

Simply open the HTML files in your browser. No build process or server is required.

### Modifying the Gallery

To add new images to the gallery:

1. Add your images to the `assets/` directory
2. Update the image paths in `gallery.html`
3. Adjust the GPX track if needed

### Customizing the CSS

The CSS is organized for easy customization:

1. Modify colors and typography in the "All Other Styles" section
2. Adjust layout behavior in the "Grid/Flexbox System" section
3. Add new responsive breakpoints as needed

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Commit your changes: `git commit -m 'Add some feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

- Photography by Nuno Rodrigues
- Map data by OpenStreetMap contributors
- GPX track visualization by Leaflet GPX Plugin

## Contact

Nuno Rodrigues - [@nunogand](https://github.com/nunogand)

---

*Note: This project is a work in progress. Features and functionality may change.*
