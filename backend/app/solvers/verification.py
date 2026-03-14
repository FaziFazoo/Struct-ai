"""
Verification engine for AI FEA Copilot.
Validates structural integrity and physical realism.
"""

class VerificationEngine:
    def __init__(self, material_properties):
        self.material = material_properties
        
    def verify(self, results):
        """
        Checks results against material limits and physical constants.
        """
        warnings = []
        status = "Safe"
        
        # Check yield strength
        max_stress = results.get("max_stress", 0)
        yield_strength = self.material.yield_strength
        
        factor_of_safety = yield_strength / max_stress if max_stress > 0 else float('inf')
        
        if max_stress > yield_strength:
            status = "Failure"
            warnings.append(f"Max bending stress ({max_stress/1e6:.2f} MPa) exceeds yield strength ({yield_strength/1e6:.2f} MPa)!")
        elif factor_of_safety < 1.5:
            status = "Warning"
            warnings.append(f"Low factor of safety: {factor_of_safety:.2f}. Structural integrity may be compromised.")
            
        # Check for unrealistic deflection (e.g., > 10% of beam length)
        max_deflection = abs(results.get("max_deflection", 0))
        beam_length = results.get("beam_length", 1.0) # Assume 1m if not provided
        
        if max_deflection > (0.1 * beam_length):
            warnings.append(f"Large deflection detected ({max_deflection*1000:.2f} mm). Linear beam theory may be inaccurate.")
            
        return {
            "status": status,
            "factor_of_safety": float(factor_of_safety),
            "warnings": warnings
        }
