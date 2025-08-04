// /* Okay so the first question, I would ask if this is going to be for a validation in the UI or if we'll do the validation in the backend.
// This will change if I write the code. Most front end libraries have built in validators, but then again back end code also has validation usually
// abstracted away with syntactic sugar.

// So i'll go ahead and just create an agnostic typescript class that creates a user object and then has a validation function that checks all values

// */

// const regex = /^\d+$/;

// interface CreatePatientDTO {
//   // eslint-disable-next-line prettier/prettier
//   id: string; // depending on what DB we're using we'd import the ID type from the node package so i'll just say string here
//   name: string;
//   dateOfBirth: Date;
//   email: string;
//   phone: string;
// }

// class Patient implements CreatePatientDTO {
//   id: string;
//   name: string;
//   dateOfBirth: Date;
//   email: string;
//   phone: string;

//   constructor(
//     id: string,
//     name: string,
//     dateOfBirth: Date,
//     email: string,
//     phone: string
//   ) {
//     this.id = id;
//     this.name = name;
//     this.dateOfBirth = dateOfBirth; // How is date formatted? As an ISO string?
//     this.email = email;
//     this.phone = phone;
//   }

//   // we could validate each property individually by creating instance methods,
//   // we could do one instance method that validates all values together,
//   // or we could do both, or we could do one static method that receives an instance
//   // I'll create a validator for each one and then have one validate method that validates all of them

//   validateEmail(): string[] {
//     // we could specify types for email errors, too
//     // must be a valid email –what is a valid email? For now i'll just check to see if it has an @ symbol
//     const validDomain = validDomains.includes(this.email.split("@")[1]);
//     if (validDomain) {
//       return [];
//     }
//     return ["Email must be valid"];
//   }

//   validatePhone(): string[] {
//     // valid phone number must be 10 digits
//     if (regex.test(this.phone) && this.phone.length === 10) {
//       return [];
//     }
//     return ["Phone number must be valid"];
//   }

//   validateAge(): string[] {
//     const today = new Date();
//     const birthday = new Date(this.dateOfBirth);
//     const cutoff = new Date();
//     cutoff.setFullYear(today.getFullYear() - 18);
//     if (birthday < cutoff) {
//       // 18 years in milliseconds
//       return [];
//     }
//     return ["Age must be 18 or greater"];
//   }

//   validatePatient(): string[] {
//     return [
//       ...this.validateEmail(),
//       ...this.validatePhone(),
//       ...this.validateAge(),
//     ];
//   }
// }

// const liz = new Patient(
//   "1",
//   "Elizabeth",
//   new Date("2000-12-06"),
//   "elizabeth@gmail.com",
//   "12223334444"
// );

// console.log(liz.validatePatient()); // should return empty array

// const tim = new Patient(
//   "1",
//   "tim",
//   new Date("2024-12-06"),
//   "elizabethgmail.com",
//   "1222333444"
// );

// console.log(tim.validatePatient()); // should have three errors

// interface Patient {
//   id: string;
//   name: string;
//   dateOfBirth: Date;
//   email: string;
//   phone: string;
// }

// const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// const PHONE_REGEX = /^\d{10}$/;

// function validatePatient(patient: Patient): string[] {
//   const errors: string[] = [];

//   // Email validation
//   if (!EMAIL_REGEX.test(patient.email)) {
//     errors.push("Email must be valid");
//   }

//   // Phone validation
//   if (!PHONE_REGEX.test(patient.phone)) {
//     errors.push("Phone must be 10 digits");
//   }

//   // Age validation
//   const today = new Date();
//   const age = today.getFullYear() - patient.dateOfBirth.getFullYear();
//   if (age < 18) {
//     errors.push("Patient must be 18 or older");
//   }

//   return errors;
// }

// // Usage examples
// const validPatient: Patient = {
//   id: "1",
//   name: "Elizabeth Johnson",
//   dateOfBirth: new Date("1995-06-15"),
//   email: "elizabeth@gmail.com",
//   phone: "1234567890",
// };

// const invalidPatient: Patient = {
//   id: "",
//   name: "",
//   dateOfBirth: new Date("2010-01-01"), // Too young
//   email: "invalid-email",
//   phone: "123", // Too short
// };

// // Test cases
// console.log("Valid patient:", validatePatient(validPatient));
// console.log("Invalid patient:", validatePatient(invalidPatient));

// We could create a class based validator that has more specific methods

// const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// const PHONE_REGEX = /^\d{10}$/;
// const MIN_AGE = 18;

// enum Country {
//   US = "US",
//   UK = "UK",
//   CA = "CA",
// }

// const PHONE_DIGITS_BY_COUNTRY = {
//   [Country.US]: 10,
//   [Country.CA]: 10,
//   [Country.UK]: 11,
// };

// interface Patient {
//   // eslint-disable-next-line prettier/prettier
//   id: string; // depending on what DB we're using we'd import the ID type from the node package so i'll just say string here
//   name: string;
//   dateOfBirth: Date;
//   email: string;
//   phone: string;
//   country: Country;
// }

// interface ValidationResult {
//   isValid: boolean;
//   errors: string[];
// }

// class PatientValidator {
//   static validatePatient(patient: Patient): ValidationResult {
//     const errors: string[] = [];

//     errors.push(
//       ...this.validateEmail(patient.email),
//       ...this.validateAge(patient.dateOfBirth),
//       ...this.validatePhone(patient.phone, patient.country)
//     );

//     return {
//       isValid: errors.length === 0,
//       errors,
//     };
//   }
//   private static validateEmail(email: string): string[] {
//     const errors: string[] = [];
//     if (!EMAIL_REGEX.test(email)) {
//       errors.push("Email must be valid");
//     }
//     return errors;
//   }

//   private static validatePhone(phone: string, country: Country): string[] {
//     const errors: string[] = [];
//     if (
//       !PHONE_REGEX.test(phone) ||
//       !(phone.length === PHONE_DIGITS_BY_COUNTRY[country])
//     ) {
//       errors.push("Phone number must be valid");
//     }
//     return errors;
//   }

//   private static validateAge(dateOfBirth: Date): string[] {
//     const today = new Date();
//     const birthday = new Date(dateOfBirth);
//     const cutoff = new Date();
//     cutoff.setFullYear(today.getFullYear() - MIN_AGE);
//     const errors: string[] = [];
//     if (birthday > cutoff) {
//       errors.push("Age must be 18 or greater");
//     }
//     return errors;
//   }
// }

// Scaled validation system for healthcare forms
// Designed for reusability across multiple entity types and validation contexts

enum Country {
  US = "US",
  UK = "UK",
  CA = "CA",
}

enum ValidationContext {
  INTAKE = "intake",
  QUICK_REGISTRATION = "quick_registration",
  PROVIDER_REGISTRATION = "provider_registration",
}

interface ValidationError {
  field: string;
  code: string;
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

interface ValidationRule<T> {
  field: keyof T;
  required?: boolean;
  validate: (value: any, context?: ValidationContext) => ValidationError | null;
}

// Base validator class that can be extended for different entity types
class BaseValidator<T> {
  constructor(private rules: ValidationRule<T>[]) {}

  validate(
    entity: T,
    context: ValidationContext = ValidationContext.INTAKE
  ): ValidationResult {
    const errors: ValidationError[] = [];

    for (const rule of this.rules) {
      const value = entity[rule.field];

      // Check if field is required in this context
      if (this.isFieldRequired(rule, context) && this.isEmpty(value)) {
        errors.push({
          field: rule.field as string,
          code: "REQUIRED",
          message: `${rule.field as string} is required`,
        });
        continue;
      }

      // Skip validation if field is empty and not required
      if (this.isEmpty(value)) continue;

      // Run field-specific validation
      const error = rule.validate(value, context);
      if (error) {
        errors.push(error);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private isFieldRequired(
    rule: ValidationRule<T>,
    context: ValidationContext
  ): boolean {
    // Could be made more sophisticated with context-specific rules
    if (context === ValidationContext.QUICK_REGISTRATION) {
      return false; // Less strict for quick registration
    }
    return rule.required ?? false;
  }

  private isEmpty(value: any): boolean {
    return value === null || value === undefined || value === "";
  }
}

// Validation utilities that can be reused across different entities
class ValidationUtils {
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly PHONE_DIGITS_BY_COUNTRY = {
    [Country.US]: 10,
    [Country.CA]: 10,
    [Country.UK]: 11,
  };

  static validateEmail(field: string) {
    return (value: string): ValidationError | null => {
      if (!this.EMAIL_REGEX.test(value)) {
        return {
          field,
          code: "INVALID_EMAIL",
          message: "Email must be a valid email address",
        };
      }
      return null;
    };
  }

  static validatePhone(field: string, country: Country) {
    return (value: string): ValidationError | null => {
      const cleanPhone = value.replace(/[\s\-\(\)\.]/g, "");
      const expectedLength = this.PHONE_DIGITS_BY_COUNTRY[country];

      if (!/^\d+$/.test(cleanPhone) || cleanPhone.length !== expectedLength) {
        return {
          field,
          code: "INVALID_PHONE",
          message: `Phone must be ${expectedLength} digits for ${country}`,
        };
      }
      return null;
    };
  }

  static validateAge(field: string, minAge: number = 18) {
    return (value: Date): ValidationError | null => {
      const today = new Date();
      const birthDate = new Date(value);
      const age = today.getFullYear() - birthDate.getFullYear();

      if (age < minAge) {
        return {
          field,
          code: "INVALID_AGE",
          message: `Must be at least ${minAge} years old`,
        };
      }
      return null;
    };
  }

  static validateSSN(field: string) {
    return (value: string): ValidationError | null => {
      const cleanSSN = value.replace(/[\s\-]/g, "");
      if (!/^\d{9}$/.test(cleanSSN)) {
        return {
          field,
          code: "INVALID_SSN",
          message: "SSN must be 9 digits",
        };
      }
      return null;
    };
  }
}

// Patient-specific interface and validator
interface Patient {
  id: string;
  name: string;
  dateOfBirth: Date;
  email: string;
  phone: string;
  country: Country;
  ssn?: string;
  emergencyContactPhone?: string;
}

class PatientValidator extends BaseValidator<Patient> {
  constructor(country: Country = Country.US) {
    const rules: ValidationRule<Patient>[] = [
      {
        field: "name",
        required: true,
        validate: () => null, // Could add name-specific validation
      },
      {
        field: "email",
        required: true,
        validate: ValidationUtils.validateEmail("email"),
      },
      {
        field: "phone",
        required: true,
        validate: ValidationUtils.validatePhone("phone", country),
      },
      {
        field: "dateOfBirth",
        required: true,
        validate: ValidationUtils.validateAge("dateOfBirth"),
      },
      {
        field: "ssn",
        required: false, // Only required in certain contexts
        validate: ValidationUtils.validateSSN("ssn"),
      },
      {
        field: "emergencyContactPhone",
        required: false,
        validate: ValidationUtils.validatePhone(
          "emergencyContactPhone",
          country
        ),
      },
    ];

    super(rules);
  }
}

// Example usage demonstrating different contexts
const patient: Patient = {
  id: "1",
  name: "John Doe",
  dateOfBirth: new Date("1990-01-01"),
  email: "john@example.com",
  phone: "1234567890",
  country: Country.US,
  ssn: "123456789",
};

const validator = new PatientValidator(Country.US);

// Different validation contexts
console.log(
  "Intake validation:",
  validator.validate(patient, ValidationContext.INTAKE)
);
console.log(
  "Quick registration:",
  validator.validate(patient, ValidationContext.QUICK_REGISTRATION)
);

// Example of how this could be extended for other entity types
interface Provider {
  id: string;
  name: string;
  email: string;
  licenseNumber: string;
}

class ProviderValidator extends BaseValidator<Provider> {
  constructor() {
    const rules: ValidationRule<Provider>[] = [
      {
        field: "name",
        required: true,
        validate: () => null,
      },
      {
        field: "email",
        required: true,
        validate: ValidationUtils.validateEmail("email"),
      },
      {
        field: "licenseNumber",
        required: true,
        validate: (value: string) => {
          // Provider-specific validation logic
          if (!/^[A-Z]{2}\d{6}$/.test(value)) {
            return {
              field: "licenseNumber",
              code: "INVALID_LICENSE",
              message: "License number must be 2 letters followed by 6 digits",
            };
          }
          return null;
        },
      },
    ];

    super(rules);
  }
}
