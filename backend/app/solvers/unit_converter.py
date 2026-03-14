"""
Unit conversion utility for AI FEA Copilot.
Ensures all inputs are converted to SI units for calculations.
"""

def to_si(value, unit):
    """
    Converts a value from a given unit to SI units.
    """
    unit = unit.lower().strip()
    
    # Length
    if unit in ['m', 'meter', 'meters']:
        return value
    if unit in ['mm', 'millimeter', 'millimeters']:
        return value / 1000.0
    if unit in ['cm', 'centimeter', 'centimeters']:
        return value / 100.0
    if unit in ['in', 'inch', 'inches']:
        return value * 0.0254
    if unit in ['ft', 'foot', 'feet']:
        return value * 0.3048
    
    # Force
    if unit in ['n', 'newton', 'newtons']:
        return value
    if unit in ['kn', 'kilonewton', 'kilonewtons']:
        return value * 1000.0
    if unit in ['lbf', 'pound', 'pounds']:
        return value * 4.44822
    
    # Pressure / Stress
    if unit in ['pa', 'pascal']:
        return value
    if unit in ['mpa', 'megapascal']:
        return value * 1e6
    if unit in ['gpa', 'gigapascal']:
        return value * 1e9
    if unit in ['psi']:
        return value * 6894.76
    
    return value # Default: assume SI
