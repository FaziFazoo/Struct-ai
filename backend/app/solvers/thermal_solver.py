"""
Thermal solver for AI FEA Copilot.
Calculates thermal strain and stress.
"""

class ThermalSolver:
    def __init__(self, material_properties, delta_t, length):
        self.alpha = material_properties.thermal_expansion # 1/K
        self.E = material_properties.youngs_modulus       # Pa
        self.delta_t = delta_t                             # K (or Celsius)
        self.L = length                                    # m
        
    def solve(self):
        """
        Calculates thermal expansion and stress (if constrained).
        """
        # Linear expansion: delta_L = alpha * L * delta_T
        delta_l = self.alpha * self.L * self.delta_t
        
        # Thermal stress (if fully constrained): sigma = alpha * delta_T * E
        thermal_stress = self.alpha * self.delta_t * self.E
        
        return {
            "thermal_expansion": delta_l,
            "thermal_stress": thermal_stress,
            "units": {
                "expansion": "m",
                "stress": "Pa"
            }
        }
