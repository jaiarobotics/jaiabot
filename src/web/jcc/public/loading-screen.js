// Track actual loading progress
(function() {
    const progressBar = document.getElementById('initial-loading-bar');
    let progress = 10; // Start at 10%
    let checkResourcesInterval = null;
    let fallbackInterval = null;
    
    // Update progress bar
    function updateProgress(value) {
        progress = Math.min(value, 95); // Cap at 95% until fully loaded
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
    }
    
    // Clean up intervals
    function cleanup() {
        if (checkResourcesInterval) clearInterval(checkResourcesInterval);
        if (fallbackInterval) clearInterval(fallbackInterval);
    }
    
    // Simulate initial loading stages
    const startTime = Date.now();
    
    // Progress through stages as DOM loads
    updateProgress(20); // HTML parsed
    
    // Monitor resource loading using Performance API
    if (window.performance && window.performance.getEntriesByType) {
        checkResourcesInterval = setInterval(function() {
            const resources = performance.getEntriesByType('resource');
            const scripts = resources.filter(r => r.initiatorType === 'script');
            
            // Calculate progress based on loaded scripts
            if (scripts.length > 0) {
                const loadedScripts = scripts.filter(s => s.responseEnd > 0);
                const scriptProgress = 30 + (loadedScripts.length / Math.max(scripts.length, 1)) * 60;
                updateProgress(scriptProgress);
            }
            
            // Clear interval after 30 seconds max
            if (Date.now() - startTime > 30000) {
                cleanup();
            }
        }, 100);
    } else {
        // Fallback: Increment progress over time only if Performance API unavailable
        fallbackInterval = setInterval(function() {
            if (progress < 90) {
                updateProgress(progress + 1);
            } else {
                clearInterval(fallbackInterval);
            }
        }, 300);
    }
    
    // Monitor for loading screen removal
    const loadingScreen = document.getElementById('initial-loading-screen');
    if (loadingScreen && loadingScreen.parentNode) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.removedNodes.length > 0) {
                    mutation.removedNodes.forEach(function(node) {
                        if (node.id === 'initial-loading-screen') {
                            updateProgress(100);
                            cleanup();
                            observer.disconnect();
                        }
                    });
                }
            });
        });
        observer.observe(loadingScreen.parentNode, { childList: true });
    }
    
    // DOM Content Loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            updateProgress(40);
        });
    } else {
        updateProgress(40);
    }
    
    // Window Load (all resources loaded)
    window.addEventListener('load', function() {
        updateProgress(95);
        cleanup();
    });
})();
