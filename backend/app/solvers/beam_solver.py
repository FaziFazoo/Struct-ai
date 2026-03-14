"""
Beam solver for AI FEA Copilot.
Calculates SFD, BMD, and Deflection for Cantilever and Simply Supported beams.
"""
import numpy as np

class BeamSolver:
    def __init__(self, length, load_magnitude, load_position, support_type, material_properties,
                 beam_width=0.1, beam_height=0.1):
        self.L = length               # m
        self.P = load_magnitude       # N
        self.a = load_position        # m (position from left support)
        self.support_type = support_type # 'cantilever' or 'simply_supported'
        self.E = material_properties.youngs_modulus # Pa

        # Cross-section: defaults to 0.1m x 0.1m if not specified by user
        self.b = beam_width   # m (width)
        self.h = beam_height  # m (height)
        self.I = (self.b * (self.h**3)) / 12.0  # Second moment of area

    def solve(self, num_points=100):
        x = np.linspace(0, self.L, num_points)
        sfd = np.zeros(num_points)
        bmd = np.zeros(num_points)
        deflection = np.zeros(num_points)
        
        if self.support_type.lower() == 'cantilever':
            # Cantilever fixed at left (x=0), load at a
            # V(x) = P if x < a, else 0 (assuming load is at end usually, but let's be general)
            # M(x) = -P(a - x) if x < a, else 0
            for i, xi in enumerate(x):
                if xi <= self.a:
                    sfd[i] = self.P
                    bmd[i] = -self.P * (self.a - xi)
                    # Deflection y(x) = (P*x^2 / (6*E*I)) * (3*a - x)
                    deflection[i] = -(self.P * xi**2) / (6 * self.E * self.I) * (3 * self.a - xi)
                else:
                    sfd[i] = 0
                    bmd[i] = 0
                    # For x > a, deflection follows slope at a
                    # y(a) = (P*a^3 / (3*E*I))
                    # slope(a) = (P*a^2 / (2*E*I))
                    ya = -(self.P * self.a**3) / (3 * self.E * self.I)
                    slope_a = -(self.P * self.a**2) / (2 * self.E * self.I)
                    deflection[i] = ya + slope_a * (xi - self.a)
                    
        elif self.support_type.lower() == 'simply_supported':
            # Simply supported at x=0 and x=L, load at a
            # Reactions: R1 = P*(L-a)/L, R2 = P*a/L
            R1 = self.P * (self.L - self.a) / self.L
            R2 = self.P * self.a / self.L
            for i, xi in enumerate(x):
                if xi <= self.a:
                    sfd[i] = R1
                    bmd[i] = R1 * xi
                    # Deflection y(x) = (P*b*x / (6*L*E*I)) * (L^2 - b^2 - x^2) where b = L-a
                    b_dist = self.L - self.a
                    deflection[i] = -(self.P * b_dist * xi) / (6 * self.L * self.E * self.I) * (self.L**2 - b_dist**2 - xi**2)
                else:
                    sfd[i] = R1 - self.P
                    bmd[i] = R1 * xi - self.P * (xi - self.a)
                    # Deflection y(x) = (P*a*(L-x) / (6*L*E*I)) * (L^2 - a^2 - (L-x)^2)
                    deflection[i] = -(self.P * self.a * (self.L - xi)) / (6 * self.L * self.E * self.I) * (self.L**2 - self.a**2 - (self.L - xi)**2)
        
        bending_stress = (np.abs(bmd) * (self.h / 2.0)) / self.I
        
        return {
            "x": x.tolist(),
            "sfd": sfd.tolist(),
            "bmd": bmd.tolist(),
            "deflection": deflection.tolist(),
            "bending_stress": bending_stress.tolist(),
            "max_deflection": float(np.min(deflection)),
            "max_stress": float(np.max(bending_stress))
        }
