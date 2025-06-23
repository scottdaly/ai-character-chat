const { DataTypes, Op } = require("sequelize");

/**
 * Credit Reservation System Models
 * Provides database models for managing credit reservations during streaming
 */

function defineReservationModels(sequelize) {
  // Credit Reservations for streaming operations
  const CreditReservation = sequelize.define(
    "CreditReservation",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      conversationId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "Conversations", 
          key: "id",
        },
        onDelete: "SET NULL",
      },
      messageId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: "Messages",
          key: "id", 
        },
        onDelete: "SET NULL",
      },
      creditsReserved: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        validate: {
          min: 0.0001,
          max: 10000, // Safety limit
        },
      },
      actualCreditsUsed: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true,
        validate: {
          min: 0,
        },
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "active",
        validate: {
          isIn: [["active", "settled", "expired", "cancelled"]],
        },
      },
      reservationType: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "streaming",
        validate: {
          isIn: [["streaming", "batch", "preprocessing", "manual"]],
        },
      },
      context: {
        type: DataTypes.JSON,
        allowNull: true,
        // Stores metadata like model, provider, estimated tokens, etc.
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
          isAfter: new Date().toISOString(), // Must be in the future
        },
      },
      settledAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      errorReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          name: "idx_reservations_user_status",
          fields: ["userId", "status"],
        },
        {
          name: "idx_reservations_expires",
          fields: ["expiresAt"],
          where: {
            status: "active",
          },
        },
        {
          name: "idx_reservations_conversation",
          fields: ["conversationId", "status"],
        },
        {
          name: "idx_reservations_message",
          fields: ["messageId"],
        },
        {
          name: "idx_reservations_type_status",
          fields: ["reservationType", "status", "createdAt"],
        },
      ],
      validate: {
        // Ensure settled reservations have settlement data
        settlementConsistency() {
          if (this.status === "settled") {
            if (!this.settledAt) {
              throw new Error("Settled reservations must have settledAt timestamp");
            }
            if (this.actualCreditsUsed === null || this.actualCreditsUsed === undefined) {
              throw new Error("Settled reservations must have actualCreditsUsed");
            }
          }
        },
        // Ensure expired reservations don't have settlement data
        expiredConsistency() {
          if (this.status === "expired" && this.actualCreditsUsed !== null) {
            throw new Error("Expired reservations should not have actualCreditsUsed");
          }
        },
        // Validate expiration is reasonable
        expirationValidation() {
          const now = new Date();
          const maxExpiration = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour max
          
          if (this.expiresAt > maxExpiration) {
            throw new Error("Reservation expiration cannot be more than 1 hour in the future");
          }
        },
      },
    }
  );

  // Reservation Settlement History for tracking changes
  const ReservationSettlement = sequelize.define(
    "ReservationSettlement",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      reservationId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "CreditReservations",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      creditsReserved: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
      },
      actualCreditsUsed: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      creditsRefunded: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      balanceBefore: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
      },
      balanceAfter: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
      },
      settlementType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: {
          isIn: [["completed", "partial", "failed", "timeout", "cancelled", "exceeded"]],
        },
      },
      tokenUsageData: {
        type: DataTypes.JSON,
        allowNull: true,
        // Stores actual vs estimated token usage
      },
      accuracyMetrics: {
        type: DataTypes.JSON,
        allowNull: true,
        // Stores estimation accuracy data
      },
      processingTime: {
        type: DataTypes.INTEGER,
        allowNull: true,
        // Duration in milliseconds
      },
    },
    {
      timestamps: true,
      indexes: [
        {
          name: "idx_settlements_reservation",
          fields: ["reservationId"],
        },
        {
          name: "idx_settlements_user_date",
          fields: ["userId", "createdAt"],
        },
        {
          name: "idx_settlements_type_date",
          fields: ["settlementType", "createdAt"],
        },
      ],
      validate: {
        // Validate credit calculations
        creditCalculation() {
          const reserved = parseFloat(this.creditsReserved);
          const used = parseFloat(this.actualCreditsUsed);
          const refunded = parseFloat(this.creditsRefunded);
          
          // If usage exceeded reservation, refund should be 0
          if (used > reserved) {
            if (refunded !== 0) {
              throw new Error(`When usage exceeds reservation, refund must be 0. Got: ${refunded}`);
            }
          } else {
            // Normal case: refund = reserved - used
            const expectedRefund = reserved - used;
            const difference = Math.abs(refunded - expectedRefund);
            
            if (difference > 0.01) {
              throw new Error(`Credits refunded must equal reserved minus used. Expected: ${expectedRefund}, Got: ${refunded}, Difference: ${difference}`);
            }
          }
        },
        // Validate balance calculation
        balanceCalculation() {
          const reserved = parseFloat(this.creditsReserved);
          const used = parseFloat(this.actualCreditsUsed);
          const balanceBefore = parseFloat(this.balanceBefore);
          const balanceAfter = parseFloat(this.balanceAfter);
          const refunded = parseFloat(this.creditsRefunded);
          
          let expectedBalance;
          if (used > reserved) {
            // When usage exceeds reservation, we need to deduct the difference
            const additionalDeduction = used - reserved;
            expectedBalance = balanceBefore - additionalDeduction;
          } else {
            // Normal case: add refund to balance
            expectedBalance = balanceBefore + refunded;
          }
          
          const difference = Math.abs(balanceAfter - expectedBalance);
          
          if (difference > 0.01) {
            throw new Error(`Balance calculation mismatch. Expected: ${expectedBalance}, Got: ${balanceAfter}, Difference: ${difference}`);
          }
        },
      },
    }
  );

  return {
    CreditReservation,
    ReservationSettlement,
  };
}

module.exports = { defineReservationModels };