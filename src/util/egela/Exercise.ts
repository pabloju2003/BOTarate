export { Exercise };

type AIRole = 'observer' | 'proofreader' | 'tutor' | 'challenger' | 'refiner';

/**
 * Represents an exercise found on an Egela page
 */
class Exercise {
    name: string;
    statement: string;
    role?: AIRole;

    constructor(name: string, statement: string, role: AIRole = 'tutor') {
        this.name = name;
        this.statement = statement;
        this.role = role;
    }

    toJSON() {
        return {
            name: this.name,
            statement: this.statement,
            role: this.role
        };
    }
}
