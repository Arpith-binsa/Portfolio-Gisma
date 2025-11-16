// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add active class to navigation based on scroll position
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-links a');
    
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        
        if (scrollY >= (sectionTop - 200)) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });
});

// Album card click handler
document.querySelectorAll('.album-card').forEach(card => {
    card.addEventListener('click', function(e) {
        if (!e.target.classList.contains('view-collection')) {
            const link = this.querySelector('.view-collection');
            if (link) {
                window.location.href = link.getAttribute('href');
            }
        }
    });
});

// Intersection observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe album cards
document.querySelectorAll('.album-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(card);
});
function imagesLoaded(parentNode) {
    const imgElements = parentNode.querySelectorAll("img");
    const promises = [];
    imgElements.forEach((img) => {
        if (img.complete) return;
        promises.push(new Promise((resolve) => {
            img.onload = img.onerror = resolve;
        }));
    });
    return Promise.all(promises);
}
loadCarouselImages();

Promise.all([
    imagesLoaded(document.querySelector('.carousel-track-1')),
    imagesLoaded(document.querySelector('.carousel-track-2')),
    imagesLoaded(document.querySelector('.carousel-track-3')),
]).then(() => {
    document.body.classList.add("carousel-ready");
});

// Ensure animations trigger after images are loaded 
img.addEventListener('load', function() {
    this.classList.add('loaded');
});
